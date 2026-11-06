"""PROVID reference video server (free, runs on your own NVIDIA GPU).

UNTESTED: written against the diffusers LTX-Video image-to-video pipeline but not run on a GPU.
Output is silent video. See server/README.md.

    pip install fastapi uvicorn pillow torch diffusers transformers accelerate imageio imageio-ffmpeg
    uvicorn provid_video_server:app --host 0.0.0.0 --port 8000

API contract used by the app:
    POST /generate  {"prompt": str, "image": "data:image/jpeg;base64,...", "seconds": 5} -> {"id": str}
    GET  /jobs/{id} -> {"status": "queued|running|complete|error", "video_url"?: str, "error"?: str}
    GET  /videos/{id}.mp4
"""
import base64, io, queue, threading, uuid
from pathlib import Path

import torch
from diffusers import LTXImageToVideoPipeline
from diffusers.utils import export_to_video
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image
from pydantic import BaseModel

OUT = Path("videos")
OUT.mkdir(exist_ok=True)
FPS = 24
NEGATIVE = "worst quality, inconsistent motion, blurry, jittery, distorted"

pipe = LTXImageToVideoPipeline.from_pretrained("Lightricks/LTX-Video", torch_dtype=torch.bfloat16)
pipe.to("cuda")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
jobs: dict[str, dict] = {}
pending: "queue.Queue[tuple[str, Image.Image, str, int]]" = queue.Queue()


class Request(BaseModel):
    prompt: str
    image: str
    seconds: int = 5


def worker():
    while True:
        job_id, image, prompt, seconds = pending.get()
        jobs[job_id]["status"] = "running"
        try:
            # LTX needs frames = 8k + 1 and sizes divisible by 32.
            frames = pipe(
                image=image, prompt=prompt, negative_prompt=NEGATIVE,
                width=704, height=480, num_frames=FPS * seconds + 1, num_inference_steps=50,
            ).frames[0]
            export_to_video(frames, str(OUT / f"{job_id}.mp4"), fps=FPS)
            jobs[job_id].update(status="complete", video_url=f"/videos/{job_id}.mp4")
        except Exception as error:  # noqa: BLE001
            jobs[job_id].update(status="error", error=str(error))


threading.Thread(target=worker, daemon=True).start()


@app.post("/generate")
def generate(request: Request):
    try:
        image = Image.open(io.BytesIO(base64.b64decode(request.image.split(",", 1)[-1]))).convert("RGB")
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Could not read the character image.")
    job_id = uuid.uuid4().hex
    jobs[job_id] = {"status": "queued"}
    pending.put((job_id, image, request.prompt, max(1, min(request.seconds, 10))))
    return {"id": job_id}


@app.get("/jobs/{job_id}")
def job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Unknown job")
    return jobs[job_id]


@app.get("/videos/{name}")
def video(name: str):
    path = OUT / Path(name).name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Unknown video")
    return FileResponse(path, media_type="video/mp4")

# PROVID video server (free, self-hosted)

Runs an open-source video model on your own NVIDIA GPU so PROVID can render shots at no per-second cost.

1. On a PC with an NVIDIA GPU and Python 3.10+: `pip install fastapi uvicorn pillow torch diffusers transformers accelerate imageio imageio-ffmpeg`
2. `uvicorn provid_video_server:app --host 0.0.0.0 --port 8000` (the first run downloads the model, several GB).
3. In PROVID, open **Settings**, choose **My own video server**, and enter `http://<that-pc's-address>:8000`.

Notes: `provid_video_server.py` is a reference implementation and has not been run on a GPU. It produces silent video; LTX-2.3 and Wan can do more, so swap the pipeline for whichever model you run. Any server that follows the contract in the file's docstring works. It allows requests from any origin and has no password, so keep it on your own network. On Android/iOS the app reaches an `http://` address because mixed content is allowed in the WebView.

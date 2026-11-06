const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const MAX_CAST = 100;
const fresh = () => ({ cast: [], title: '', script: '', shots: [], signature: '', brief: '' });
let project = fresh(), apiKey = '', page = 0, selected = 0, editing = -1, busy = false;
let portrait = '', movieURL = '', playingAll = false;
let requestedCharacterStep;
let characterSource = 'upload';
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.open('probix-film-studio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('projects');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
}).catch(() => null);
if (db) project = await new Promise(resolve => {
  const request = db.transaction('projects').objectStore('projects').get('active');
  request.onsuccess = () => resolve(request.result || fresh());
  request.onerror = () => resolve(fresh());
});
const activity = [];
function notice(message = '') { $('notice').textContent = message; }
function log(message) {
  notice(message);
  activity.unshift(message);
  if (activity.length > 40) activity.pop();
  $('activity-count').textContent = '(' + activity.length + ')';
  $('activity-list').innerHTML = activity.map(item => '<li>' + escapeHTML(item) + '</li>').join('');
}
function openStage(stage, index) {
  if (busy) return;
  if (index !== undefined) selected = index;
  go(stage);
  $('heading').focus({preventScroll:true});
  $('inspector').scrollIntoView({block:'start'});
}
function save() {
  if (!db) return notice('Browser storage is unavailable. Keep this tab open to retain your work.');
  const transaction = db.transaction('projects', 'readwrite');
  transaction.objectStore('projects').put(project, 'active');
  transaction.onerror = () => notice('Project could not be saved. Check available browser storage.');
}
const tabs = ['Characters', 'Full script', 'Movie workspace'];
const descriptions = ['Build your cast from reference images and give each character a consistent look.',
  'Paste your complete screenplay. The studio will plan the shots from your cast and script.',
  'Watch the cut, request a change to a shot, or export your film.'];
function go(next) {
  if (busy) return;
  playingAll = false;
  page = next;
  notice();
  render();
}
function run(action) {
  return async event => {
    event?.preventDefault();
    if (busy) return;
    busy = true;
    const buttons = [...$('content').querySelectorAll('button'), ...$('board').querySelectorAll('button'), $('open-skill')];
    buttons.forEach(button => button.disabled = true);
    try { await action(); }
    catch (error) { log(error.message); }
    finally {
      busy = false;
      buttons.forEach(button => button.disabled = false);
      renderBoard();
    }
  };
}
function render() {
  $('heading').textContent = tabs[page];
  $('sub').textContent = descriptions[page];
  renderBoard();
  [renderCast, renderScript, renderMovie][page]();
}
function renderBoard() {
  $('skill-status').textContent = project.skill?.name || 'No skill imported';
  $('open-skill').textContent = project.skill ? 'Manage skill' : 'Import skill';
  const current = project.signature === signature();
  const shots = project.shots;
  const pending = current ? shots.filter(shot => !shot.video).length : 0;
  const ready = current && shots.length > 0 && !pending;
  const card = (text, stage, index, status, image) =>
    `<button type="button" class="board-card" data-stage="${stage}" ${index === undefined ? '' : 'data-index="' + index + '"'}>` +
    (image ? '<img src="' + escapeHTML(image) + '" alt="">' : '') +
    '<span>' + escapeHTML(text) + (status ? '<small>' + escapeHTML(status) + '</small>' : '') + '</span></button>';
  const stages = [
    ['Characters', project.cast.length, project.cast.length ?
      project.cast.map((person,index) => card(person.name,'cast',index,'Age ' + person.age + (person.status === 'draft' ? ' · Draft' : ' · Ready'),person.image)).join('') :
      '<p class="empty-stage">Saved characters appear here.</p>'],
    ['Full script', project.script.trim() ? 1 : 0, card(project.script.trim() ? project.title || 'Untitled screenplay' : '+ Add full script','script',undefined,
      project.script.trim() ? 'Screenplay saved' : 'Paste or import your screenplay')],
    ['Generate', pending, ready ? '<p class="empty-stage">All shots rendered.</p>' : pending ?
      shots.map((shot,index) => shot.video ? '' : card(shot.title,'movie',index,shot.job ? 'Rendering' : shot.error ? 'Retry available' : 'Queued')).join('') :
      card('Generate Movie','generate',undefined,'Plan and render all shots')],
    ['Refine', shots.filter(shot => shot.video).length, shots.filter(shot => shot.video).length ?
      shots.map((shot,index) => shot.video ? card(shot.title,'movie',index,shot.candidate ? 'Replacement ready' : shot.editJob?.job ? 'Touch-up rendering' : 'Ready to review') : '').join('') :
      '<p class="empty-stage">Rendered shots appear here for touch-ups.</p>'],
    ['Export', ready ? 1 : 0, ready ? card('Finished cut','export',undefined,'Play or download') :
      '<p class="empty-stage">Available when all shots are rendered.</p>']
  ];
  const activeSource = page === 0 && editing < 0 ? characterSource : '';
  const characterAction = (mode, label, description) =>
    `<button type="button" class="character-nav character-nav-${mode}" data-stage="cast-${mode}"
      ${activeSource === mode ? 'aria-current="page"' : ''}>
      <span class="character-nav-icon" aria-hidden="true">${mode === 'upload' ? '+' : '✦'}</span>
      <span><strong>${label}</strong><small>${description}</small></span></button>`;
  $('board').innerHTML =
    characterAction('upload','Add character','Upload an existing portrait') +
    characterAction('generate','Generate character','Create a new portrait with Gemini') +
    stages.map(([title,count,cards],index) =>
    `<section class="stage ${(page === 0 && index === 0 || page === 1 && index === 1 || page === 2 && index >= 2) ? 'stage-open' : ''}"><div class="stage-header"><span>0${index + 1}</span><h2>${title}</h2><b>${count}</b></div><div class="stage-cards">${cards}</div></section>`).join('');
  $('board').querySelectorAll('button').forEach(button => {
    button.disabled = busy;
    button.onclick = () => {
      const index = button.dataset.index === undefined ? undefined : Number(button.dataset.index);
      switch (button.dataset.stage) {
        case 'cast-upload':
        case 'cast': graphQuery = ''; editing = index ?? -1; characterSource = 'upload'; openStage(0); break;
        case 'cast-generate': graphQuery = ''; editing = -1; characterSource = 'generate'; openStage(0); $('appearance').focus(); break;
        case 'script': openStage(1); break;
        case 'generate': openStage(1); $('generate').focus(); break;
        case 'export': openStage(2,0); $('export')?.focus(); break;
        default: openStage(2,index);
      }
    };
  });
}
async function readPortrait(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) throw Error('Choose a PNG, JPEG, or WebP image.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#18151c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', .85);
}
const readyCast = () => project.cast.filter(person => person.status !== 'draft');
let graphZoom = 1;
let graphQuery = '';
let graphScroll = {left:0,top:0};

function mountCharacterGraph(openNode) {
  const viewport = $('graph-viewport');
  const canvas = $('graph-canvas');
  const world = $('graph-world');
  function setZoom(value) {
    graphZoom = Math.max(.5, Math.min(1.5, value));
    world.style.transform = 'scale(' + graphZoom + ')';
    canvas.style.width = world.offsetWidth * graphZoom + 'px';
    canvas.style.height = world.offsetHeight * graphZoom + 'px';
    $('graph-zoom').textContent = Math.round(graphZoom * 100) + '%';
  }
  setZoom(graphZoom);
  viewport.scrollLeft = graphScroll.left;
  viewport.scrollTop = graphScroll.top;
  viewport.onscroll = () => { graphScroll = {left:viewport.scrollLeft,top:viewport.scrollTop}; };
  $('zoom-out').onclick = () => setZoom(graphZoom - .15);
  $('zoom-in').onclick = () => setZoom(graphZoom + .15);
  $('graph-fit').onclick = () => {
    setZoom(Math.min(1, viewport.clientWidth / world.offsetWidth));
    viewport.scrollTo(0,0);
  };
  let pan;
  viewport.onpointerdown = event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    pan = {x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    viewport.setPointerCapture(event.pointerId);
  };
  viewport.onpointermove = event => {
    if (pan) viewport.scrollTo(pan.left + pan.x - event.clientX, pan.top + pan.y - event.clientY);
  };
  viewport.onpointerup = viewport.onpointercancel = () => { pan = null; };
  canvas.onclick = event => {
    const node = event.target.closest('[data-node]');
    if (node && !busy) openNode(Number(node.dataset.person), Number(node.dataset.node));
  };
}

function drawCharacterGraph(step, proposed) {
  const query = graphQuery.trim().toLowerCase();
  const rows = project.cast.map((person,index) => ({person,index}))
    .filter(({person}) => person.name.toLowerCase().includes(query));
  if (editing < 0 && !query && project.cast.length < MAX_CAST) rows.unshift({person:{name:'New character',image:portrait,status:'draft'},index:-1});
  const height = Math.max(218, 22 + rows.length * 190);
  const nodes = [];
  const edges = [];
  for (const [{person,index}, row] of rows.map((item,row) => [item,row])) {
    const y = 20 + row * 190;
    const active = editing === index;
    const image = active ? portrait : person.image;
    const approval = index >= 0 && person.status !== 'draft';
    const variant = active && proposed;
    const labels = ['Portrait','Refine','Approve'];
    const statuses = [image ? 'Reference added' : 'Upload or generate',
      variant ? 'Variation ready' : 'Look & direction',
      approval ? 'Ready for movie' : 'Review the profile'];
    const coordinates = [[24,y],[272,y + 14],[540,y]];
    coordinates.forEach(([x,top],node) => {
      const thumbnail = node === 1 ? variant || image : image;
      nodes.push(`<button type="button" class="graph-node ${active && step === node ? 'node-active' : ''}" data-person="${index}" data-node="${node}" style="left:${x}px;top:${top}px"
        ${active && step === node ? 'aria-current="step"' : ''}>
        <span class="node-type">0${node + 1} · ${labels[node]}</span>
        ${thumbnail ? '<img alt="" src="' + escapeHTML(thumbnail) + '">' : '<span class="node-placeholder" aria-hidden="true">◇</span>'}
        <strong>${escapeHTML(active ? $('name').value.trim() || person.name : person.name)}</strong>
        <small>${statuses[node]}</small></button>`);
    });
    edges.push(`<path d="M200 ${y + 76} C233 ${y + 76} 239 ${y + 90} 272 ${y + 90} M448 ${y + 90} C490 ${y + 90} 498 ${y + 76} 540 ${y + 76}"/>`);
  }
  const world = $('graph-world');
  world.style.height = height + 'px';
  world.innerHTML = `<svg width="740" height="${height}" aria-hidden="true">${edges.join('')}</svg>` + (nodes.length ? nodes.join('') : '<p class="graph-empty">No matching characters.</p>');
  $('graph-canvas').style.height = height * graphZoom + 'px';
}

function renderCast() {
  const character = project.cast[editing] || {};
  let step = character.status === 'draft' ? 1 : editing >= 0 ? 2 : 0;
  const requested = requestedCharacterStep;
  requestedCharacterStep = undefined;
  let proposed = '';
  portrait = character.image || '';
  $('content').innerHTML = `
    <div class="graph-workspace">
    <section class="graph-panel" aria-label="Character workflow graph">
      <div class="graph-toolbar"><strong>Character Graph</strong><button type="button" id="add-graph">+ Add character</button><button type="button" id="generate-graph" class="primary">Generate character</button>
      <button type="button" id="zoom-out" aria-label="Zoom out">−</button><span id="graph-zoom">100%</span>
      <button type="button" id="zoom-in" aria-label="Zoom in">+</button><button type="button" id="graph-fit">Fit width</button></div>
      <div class="graph-search"><input id="character-search" type="search" aria-label="Find a character" placeholder="Find a character…" value="${escapeHTML(graphQuery)}">
      <small id="cast-capacity">${project.cast.length} / ${MAX_CAST} characters</small></div>
      <div id="graph-viewport" tabindex="0" aria-label="Character graph canvas. Drag the background or scroll to pan.">
      <div id="graph-canvas"><div id="graph-world"></div></div></div>
    </section>
    <form id="cast" class="panel">
    <h2>${editing < 0 ? (characterSource === 'generate' ? 'Generate character' : 'Add character') : escapeHTML(character.name)}</h2>
    <div class="character-steps" hidden aria-label="Character workflow">
      <button type="button" data-step="0">01 · Create or Import</button>
      <button type="button" data-step="1">02 · Refine</button>
      <button type="button" data-step="2">03 · Review &amp; Approve</button>
    </div>
    <section id="source-step">
      <p>${characterSource === 'generate' ? 'Describe your character to create a new portrait with Gemini. Add a name and age before saving.' : 'Upload an existing portrait and enter the character’s name and age.'}</p>
      <div class="grid"><label>Name<input id="name" required maxlength="80" value="${escapeHTML(character.name)}"></label>
      <label>Age<input id="age" required type="number" min="0" max="999" value="${escapeHTML(character.age)}"></label></div>
      <div ${characterSource === 'generate' ? 'hidden' : ''}><label>Character image <small>Upload an image from any image generator or your own files</small><input id="portrait" type="file" accept="image/png,image/jpeg,image/webp"></label></div>
      <div ${characterSource === 'upload' ? 'hidden' : ''}><label>Portrait prompt<textarea id="appearance" maxlength="1000" placeholder="Example: A full-body portrait of a Dahomey warrior with braided hair, a red cloak, and leather armour"></textarea></label>
      <button type="button" id="image-generate" class="primary">Generate portrait with Gemini</button></div>
    </section>
    <section id="refine-step">
      <label>Fine-tuning <small>Optional · clothing, voice, personality and movement</small>
      <textarea id="notes" maxlength="2000" placeholder="Wardrobe, hairstyle, voice, accent or mannerisms">${escapeHTML(character.notes)}</textarea></label>
      <label>Portrait edit <small>Optional</small><input id="image-direction" maxlength="1000" placeholder="Example: Change her cloak to deep red"></label>
      <button type="button" id="edit-portrait">Preview portrait edit</button>
    </section>
    <section id="review-step"><p id="character-summary"></p><p>Approve this reference to make the character available for movie generation.</p></section>
    <div id="image-preview"></div>
    <div class="actions"><button class="primary" id="character-next">Continue</button>
    <button type="button" id="remove-character" ${editing < 0 ? 'hidden' : ''}>Remove character</button></div></form></div>
    <div class="actions"><button id="next" class="primary">Next: paste your full script →</button><button id="open-movie">Open Movie</button></div>`;
  const steps = [...$('cast').querySelectorAll('[data-step]')];
  function showPortrait() {
    drawCharacterGraph(step, proposed);
    $('image-preview').innerHTML = portrait ? `<div class="portrait-review">
      <figure><img alt="Current reference" src="${escapeHTML(portrait)}"><figcaption>Current reference</figcaption></figure>
      ${proposed ? `<figure><img alt="Proposed reference" src="${escapeHTML(proposed)}"><figcaption>Proposed reference</figcaption>
        <div class="actions"><button type="button" id="use-portrait">Use edit</button><button type="button" id="discard-portrait">Discard</button></div></figure>` : ''}
      </div>` : '';
    if (proposed) {
      $('use-portrait').onclick = () => { portrait = proposed; proposed = ''; showPortrait(); };
      $('discard-portrait').onclick = () => { proposed = ''; showPortrait(); };
    }
  }
  function showStep(next) {
    step = next;
    ['source-step','refine-step'].forEach(id => { $(id).hidden = false; });
    $('review-step').hidden = true;
    steps.forEach((button,index) => {
      if (index === step) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    });
    $('character-next').textContent = editing < 0 ? 'Save character' : 'Save character changes';
    $('character-summary').textContent = $('name').value.trim() + ' · Age ' + $('age').value +
      ($('notes').value.trim() ? ' · ' + $('notes').value.trim() : '');
    showPortrait();
  }
  function validCharacter() {
    if (editing < 0 && project.cast.length >= MAX_CAST) {
      notice('This project has 100 characters. Remove one before adding another.');
      return false;
    }
    const name = $('name').value.trim();
    if (!name || !$('age').checkValidity() || !portrait) {
      showStep(0);
      notice('Enter the character’s name and age, then add a portrait.');
      return false;
    }
    if (project.cast.some((person,index) => index !== editing && person.name.toLowerCase() === name.toLowerCase())) {
      showStep(0);
      notice('Use a unique name for each character.');
      return false;
    }
    return true;
  }
  function saveCharacter(approved) {
    const person = {name:$('name').value.trim(), age:Number($('age').value), notes:$('notes').value.trim(), image:portrait};
    if (!approved) person.status = 'draft';
    if (editing < 0) editing = project.cast.push(person) - 1;
    else project.cast[editing] = person;
    $('remove-character').hidden = false;
    $('cast-capacity').textContent = project.cast.length + ' / ' + MAX_CAST + ' characters';
    save();
    renderBoard();
    return person;
  }
  function advance(next) {
    if (busy || next === step) return;
    if (next > step) {
      if (!validCharacter()) return;
      if (proposed) return notice('Use or discard the proposed portrait before continuing.');
      if (editing < 0 || project.cast[editing].status === 'draft') saveCharacter(false);
    }
    notice();
    showStep(next);
  }
  async function generatePortrait(prompt, source) {
    const parts = [{text:prompt}];
    if (source) parts.push({inlineData:{mimeType:'image/jpeg',data:source.split(',')[1]}});
    const response = await gemini('/models/gemini-2.5-flash-image:generateContent', {contents:[{parts}]});
    const image = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData;
    if (!image) throw Error('Gemini did not return a portrait.');
    const blob = await (await fetch('data:' + image.mimeType + ';base64,' + image.data)).blob();
    return readPortrait(blob);
  }
  steps.forEach((button,index) => { button.onclick = () => advance(index); });
  $('portrait').onchange = run(async () => {
    const file = $('portrait').files[0];
    if (!file) return;
    portrait = await readPortrait(file);
    proposed = '';
    showPortrait();
    notice();
  });
  $('image-generate').onclick = run(async () => {
    if (editing < 0 && project.cast.length >= MAX_CAST) throw Error('This project has 100 characters. Remove one before adding another.');
    const description = $('appearance').value.trim();
    const name = $('name').value.trim();
    const age = $('age').value;
    if (!description && !(name && $('age').checkValidity())) throw Error('Describe the portrait you want, or enter the character’s name and age.');
    const profile = [name && 'Name: ' + name, age && $('age').checkValidity() && 'Age: ' + age].filter(Boolean).join('. ');
    notice('Generating a character portrait…');
    portrait = await generatePortrait('Generate one full-body cinematic character portrait. ' + [profile,description].filter(Boolean).join('. ') + productionDirection());
    proposed = '';
    showPortrait();
    notice('Portrait ready.');
  });
  $('edit-portrait').onclick = run(async () => {
    const direction = $('image-direction').value.trim();
    if (!direction || !portrait) throw Error('Add a portrait and describe the change.');
    notice('Rendering a portrait variation…');
    proposed = await generatePortrait('Edit the supplied character portrait. Preserve the character’s identity and every feature outside this request: ' + direction, portrait);
    showPortrait();
    notice('Compare the proposed portrait with your current reference.');
  });
  $('cast').onsubmit = event => {
    event.preventDefault();
    if (busy) return;
    if (!validCharacter()) return;
    if (proposed) return notice('Use or discard the proposed portrait before approving.');
    const person = saveCharacter(true);
    renderCast();
    log('Character saved · ' + person.name + '. Add another character or continue to your full script.');
  };
  $('add-graph').onclick = () => {
    if (project.cast.length >= MAX_CAST) return notice('This project has 100 characters. Remove one before adding another.');
    graphQuery = '';
    editing = -1;
    characterSource = 'upload';
    graphScroll = {left:0,top:0};
    renderCast();
    renderBoard();
    $('name').focus({preventScroll:true});
  };
  $('generate-graph').onclick = () => {
    if (project.cast.length >= MAX_CAST) return notice('This project has 100 characters. Remove one before adding another.');
    if (editing >= 0 || characterSource !== 'generate') {
      editing = -1;
      characterSource = 'generate';
      graphScroll = {left:0,top:0};
      renderCast();
    } else {
      showStep(0);
    }
    renderBoard();
    $('appearance').focus();
  };
  $('next').onclick = () => go(1);
  $('open-movie').onclick = () => go(2);
  $('remove-character').onclick = () => {
    if (editing < 0 || !confirm('Remove this character from the cast?')) return;
    project.cast.splice(editing, 1);
    editing = -1;
    save();
    renderCast();
    renderBoard();
  };
  $('character-search').oninput = () => {
    graphQuery = $('character-search').value;
    drawCharacterGraph(step, proposed);
    $('graph-viewport').scrollTop = 0;
  };
  $('name').oninput = () => drawCharacterGraph(step, proposed);
  showStep(step);
  mountCharacterGraph((index, node) => {
    if (index === editing) return advance(node);
    editing = index;
    characterSource = 'upload';
    requestedCharacterStep = node;
    renderCast();
    renderBoard();
  });
  if (requested !== undefined) advance(requested);
}
function renderScript() {
  $('content').innerHTML = `<div class="panel">
    <label>Movie title<input id="title" maxlength="100" value="${escapeHTML(project.title)}" placeholder="Untitled movie"></label>
    <label>Full script<textarea id="script" placeholder="EXT. PALACE GATE — DUSK&#10;&#10;The Palace Messenger approaches Senami…">${escapeHTML(project.script)}</textarea></label>
    <label>Or import a script<input id="script-file" type="file" accept=".txt,.fountain,.md,text/plain"></label>
    <p>${readyCast().length} approved cast member(s). The app checks the cast and shot plan before rendering. Generating sends the script and selected portrait references to Gemini and can incur API charges.</p>
    <div class="actions"><button class="primary" id="generate">Generate Movie →</button></div></div>`;
  $('title').oninput = () => { project.title = $('title').value; save(); renderBoard(); };
  $('script').oninput = () => { project.script = $('script').value; save(); renderBoard(); };
  $('script-file').onchange = run(async () => {
    const file = $('script-file').files[0];
    if (!file) return;
    if (file.size > 1000000) throw Error('Choose a script under 1 MB.');
    $('script').value = await file.text();
    $('script').oninput();
  });
  $('generate').onclick = () => {
    if (!readyCast().length || !project.script.trim()) return notice('Approve at least one character and add your full script first.');
    if (!apiKey) return $('dialog').showModal();
    openStage(2);
    run(generateMovie)();
  };
}
async function gemini(path, body) {
  if (!apiKey) { $('dialog').showModal(); throw Error('Add your Gemini API key to continue.'); }
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta' + path, {
    method: body ? 'POST' : 'GET',
    headers: {'Content-Type':'application/json', 'x-goog-api-key':apiKey, ...(path.startsWith('/interactions') ? {'Api-Revision':'2026-05-20'} : {})},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error?.message || 'Gemini returned HTTP ' + response.status);
  return data;
}
const signature = () => JSON.stringify([project.title, project.script, readyCast(), ...(project.brief ? [project.brief] : []), ...(project.skill ? [project.skill.instructions] : [])]);
const productionDirection = () => [project.brief, project.skill?.instructions].filter(Boolean).join('\n\n');
function validateShotPlan(plan, cast) {
  if (!Array.isArray(plan?.missingCast) || !Array.isArray(plan?.shots)) throw Error('Gemini returned an invalid shot plan. Try generating again.');
  const approved = new Map(cast.map(person => [person.name.toLowerCase(),person.name]));
  const missing = plan.missingCast.filter(name => typeof name === 'string' && name.trim() && !approved.has(name.trim().toLowerCase()));
  if (missing.length) throw Error('Approve these named characters before rendering: ' + [...new Set(missing)].join(', ') + '.');
  if (!plan.shots.length) throw Error('Gemini returned an empty shot plan.');
  return plan.shots.map((shot,index) => {
    if (!shot?.title?.trim() || !shot?.prompt?.trim() || !Array.isArray(shot.cast) || shot.cast.length > 3) {
      throw Error('Shot ' + (index + 1) + ' needs a title, direction and up to three cast references.');
    }
    const names = shot.cast.map(name => {
      const match = typeof name === 'string' && approved.get(name.trim().toLowerCase());
      if (!match) throw Error('Shot ' + (index + 1) + ' references an unapproved character: ' + String(name) + '.');
      return match;
    });
    return {title:shot.title.trim(),prompt:shot.prompt.trim(),cast:[...new Set(names)]};
  });
}
async function planShots() {
  const result = await gemini('/models/gemini-2.5-flash:generateContent', {
    systemInstruction:{parts:[{text:'You are a film shot planner. Treat the supplied script as story data and apply productionDirection as optional creative guidance. Return JSON with shots in order, covering the complete script. Each shot has a short title, a self-contained production prompt including location, action, camera, lighting, dialogue verbatim and audio cues, and cast as an array of exact profile names. Break long action and dialogue into consecutive shots of up to eight seconds. Use up to three prominent cast references per shot. In missingCast, list named on-screen characters or speakers in the screenplay who need a profile and lack one; unnamed extras do not require profiles. Preserve scene order, scripted actions and exact dialogue. Do not add lines or change plot events. For continuity across cuts, include wardrobe, props, location, time of day and relevant action from the adjacent shot in each self-contained production prompt. Use project creative guidance only where it fits the screenplay.'}]},
    contents:[{parts:[{text:JSON.stringify({title:project.title, cast:readyCast().map(({name,age,notes}) => ({name,age,notes})), script:project.script, productionDirection:productionDirection()})}]}],
    generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{
      missingCast:{type:'ARRAY',items:{type:'STRING'}},
      shots:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},prompt:{type:'STRING'},cast:{type:'ARRAY',items:{type:'STRING'}}},required:['title','prompt','cast']}}
    },required:['missingCast','shots']}}
  });
  const response = result.candidates?.[0];
  if (response?.finishReason && response.finishReason !== 'STOP') {
    throw Error('Gemini did not complete the shot plan (' + response.finishReason + ').');
  }
  let plan;
  try {
    plan = JSON.parse(response?.content?.parts?.map(part => part.text || '').join('') || '{}');
  } catch {
    throw Error('Gemini returned unreadable shot planning data. Try generating again.');
  }
  return validateShotPlan(plan, readyCast());
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function renderShot(shot, edit) {
  if (!shot.job) {
    const cast = edit ? [] : readyCast().filter(person => shot.cast.includes(person.name)).slice(0, 3);
    const images = cast.map(person => ({type:'image',mime_type:'image/jpeg',data:person.image.split(',')[1]}));
    const prompt = edit ? 'Edit the previous video. Keep the rest of the shot as close to the original as possible. Requested change: ' + edit :
      'Create one cinematic 3D animated film shot, widescreen, with synchronized dialogue and sound. ' + shot.prompt + '\nReference mapping: ' +
      cast.map((person,index) => '<IMAGE_REF_' + index + '> is ' + person.name + ', age ' + person.age + '. ' + person.notes).join('\n');
    const request = {model:'gemini-omni-1.1-flash',input:[...(edit ? [] : images),{type:'text',text:prompt}],background:true};
    if (edit) request.previous_interaction_id = shot.interaction;
    const started = await gemini('/interactions', request);
    if (!started.id) throw Error('Gemini did not return a render job.');
    shot.job = started.id;
    save();
    renderBoard();
  }
  for (let attempt = 0; attempt < 180; attempt++) {
    const result = await gemini('/interactions/' + encodeURIComponent(shot.job));
    if (result.status === 'completed') {
      const outputs = [...(result.outputs || []), ...(result.steps || []).flatMap(step => step.type === 'model_output' ? step.content || [] : [])];
      const output = outputs.find(part => part.type === 'video' && (part.data || part.uri));
      if (!output) { delete shot.job; save(); throw Error('Gemini completed the job without returning video.'); }
      let blob;
      if (output.data) blob = await (await fetch('data:' + (output.mime_type || 'video/mp4') + ';base64,' + output.data)).blob();
      else {
        const url = new URL(output.uri);
        if (url.protocol !== 'https:' || !['generativelanguage.googleapis.com','storage.googleapis.com'].includes(url.hostname)) throw Error('Gemini returned an unsupported video download URL.');
        const response = await fetch(url, {headers:url.hostname === 'generativelanguage.googleapis.com' ? {'x-goog-api-key':apiKey} : {}});
        if (!response.ok) throw Error('Could not download the generated shot.');
        blob = await response.blob();
      }
      const replacement = {video:blob,interaction:shot.job};
      delete shot.job;
      return replacement;
    }
    if (!['in_progress','queued','pending','running'].includes(result.status)) {
      delete shot.job;
      save();
      throw Error(result.error?.message || 'Gemini video job ended with status ' + result.status + '.');
    }
    await pause(5000);
  }
  throw Error('The shot is still rendering. Use Resume Generation to check the existing job.');
}
async function generateMovie() {
  if (!apiKey) { $('dialog').showModal(); return; }
  const current = signature();
  if (current !== project.signature || !project.shots.length) {
    log('Reading your full script and planning shots…');
    const shots = await planShots();
    project.shots = shots;
    project.signature = current;
    selected = 0;
    save();
    renderBoard();
    log(shots.length + ' shots queued.');
  }
  try {
    for (const [index, shot] of project.shots.entries()) {
      if (shot.video) continue;
      log('Rendering shot ' + (index + 1) + ' of ' + project.shots.length + ' · ' + shot.title);
      delete shot.error;
      try {
        Object.assign(shot, await renderShot(shot, ''));
      } catch (error) {
        shot.error = error.message;
        throw Error('Shot ' + (index + 1) + ' · ' + shot.title + ': ' + error.message + ' Use Resume Generation to continue from this shot.');
      } finally {
        save();
        renderBoard();
      }
    }
    selected = 0;
    log('First cut ready. Play the movie or select a shot to revise.');
  } finally { renderMovie(); }
}
function renderMovie() {
  if (movieURL) URL.revokeObjectURL(movieURL);
  const shot = project.shots[selected];
  const current = project.signature === signature();
  const complete = current && project.shots.length > 0 && project.shots.every(item => item.video);
  const video = shot?.candidate?.video || shot?.video;
  movieURL = video ? URL.createObjectURL(video) : '';
  $('content').innerHTML = `<div class="split"><section class="panel">
    <h2>${escapeHTML(project.title || 'Untitled movie')}</h2>
    <div class="screen">${video ? '<video id="player" playsinline controls></video>' : '<div><h3>◈ &nbsp; Screening room</h3><p>Your generated shots will appear here.</p></div>'}</div>
    <div class="shots">${project.shots.map((item,index) => `<button data-shot="${index}" class="${index === selected ? 'active' : ''}">${index + 1} · ${escapeHTML(item.title)}${item.video ? ' ✓' : ''}</button>`).join('')}</div>
    <div class="actions">
      ${complete ? '<button class="primary" id="play-all">Play movie</button><button id="export">Download movie</button>' :
        '<button class="primary" id="resume">' + (current && project.shots.length ? 'Resume Generation' : 'Generate Movie') + '</button>'}
    </div></section><section class="panel"><h2>Touch up this shot</h2><p>Select the scene below the player, then describe exactly what to change. Preview the replacement before applying it.</p>
    ${shot?.video ? `<p>Shot ${selected + 1} · ${escapeHTML(shot.title)}</p>
      ${shot.candidate ? '<p>You’re previewing a proposed replacement.</p><div class="actions"><button class="primary" id="apply">Apply change</button><button id="discard">Discard</button></div>' :
      `<form id="touch"><label>What would you like to change?<textarea id="direction" required maxlength="2000" placeholder="Make Senami whisper her line.">${escapeHTML(shot.editJob?.direction)}</textarea></label><button class="primary">${shot.editJob?.job ? 'Resume touch-up' : 'Preview touch-up'}</button></form>`}` :
      '<p>Select a rendered shot to describe a change in plain language.</p>'}
    </section></div>`;
  const player = $('player');
  if (player) {
    player.src = movieURL;
    if (playingAll) {
      player.src = shot.candidate ? URL.createObjectURL(shot.video) : movieURL;
      if (shot.candidate) {
        URL.revokeObjectURL(movieURL);
        movieURL = player.src;
      }
      player.play().catch(() => { playingAll = false; });
      player.onended = () => {
        if (!playingAll) return;
        if (selected < project.shots.length - 1) { selected++; renderMovie(); }
        else playingAll = false;
      };
    }
  }
  $('content').querySelectorAll('[data-shot]').forEach(button => button.onclick = () => {
    playingAll = false;
    selected = Number(button.dataset.shot);
    renderMovie();
  });
  if ($('resume')) $('resume').onclick = run(async () => {
    if (!readyCast().length || !project.script.trim()) throw Error('Approve at least one character and add your full script first.');
    await generateMovie();
  });
  if ($('play-all')) $('play-all').onclick = () => { playingAll = true; selected = 0; renderMovie(); };
  if ($('export')) $('export').onclick = run(async () => {
    playingAll = false;
    player?.pause();
    await exportMovie();
  });
  if ($('touch')) $('touch').onsubmit = run(async () => {
    const direction = $('direction').value.trim();
    if (!direction) throw Error('Describe the change you want.');
    if (shot.editJob?.job && shot.editJob.direction !== direction) throw Error('Resume the existing touch-up using its original wording first.');
    playingAll = false;
    player?.pause();
    shot.editJob ||= {direction, interaction:shot.interaction};
    shot.editJob.direction = direction;
    log('Rendering a replacement for shot ' + (selected + 1) + '…');
    try {
      shot.candidate = await renderShot(shot.editJob, direction);
      delete shot.editJob;
      save();
      log('Replacement ready to preview.');
    } finally { renderMovie(); }
  });
  if ($('apply')) $('apply').onclick = () => {
    Object.assign(shot, shot.candidate);
    delete shot.candidate;
    save();
    log('Change applied.');
    renderBoard();
    renderMovie();
  };
  if ($('discard')) $('discard').onclick = () => { delete shot.candidate; save(); notice(); renderMovie(); renderBoard(); };
}
async function exportMovie() {
  const formats = ['video/mp4','video/webm;codecs=vp8,opus','video/webm'];
  const mimeType = formats.find(type => globalThis.MediaRecorder?.isTypeSupported(type));
  if (!mimeType) throw Error('Movie export requires a browser with MP4 or WebM recording support.');
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const video = document.createElement('video');
  video.playsInline = true;
  const audio = new AudioContext();
  const destination = audio.createMediaStreamDestination();
  audio.createMediaElementSource(video).connect(destination);
  const stream = canvas.captureStream(24);
  stream.addTrack(destination.stream.getAudioTracks()[0]);
  let frame, url;
  const recorder = new MediaRecorder(stream, {mimeType,videoBitsPerSecond:5000000});
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = resolve;
    recorder.onerror = () => reject(Error('The browser could not encode the movie.'));
  });
  finished.catch(() => {});
  const draw = () => {
    if (video.readyState >= 2) {
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const w = video.videoWidth * scale, h = video.videoHeight * scale;
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(video,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
    }
    frame = requestAnimationFrame(draw);
  };
  try {
    await audio.resume();
    for (const [index, shot] of project.shots.entries()) {
      notice('Exporting shot ' + (index + 1) + ' of ' + project.shots.length + '. Keep this tab visible.');
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(shot.video);
      video.src = url;
      const ended = new Promise((resolve,reject) => {
        video.onended = resolve;
        video.onerror = () => reject(Error('Could not decode shot ' + (index + 1) + '.'));
      });
      ended.catch(() => {});
      await video.play();
      if (index === 0) { draw(); recorder.start(); }
      await ended;
    }
    recorder.stop();
    await finished;
    const download = document.createElement('a');
    download.href = URL.createObjectURL(new Blob(chunks, {type:mimeType}));
    download.download = (project.title.trim() || 'movie') + (mimeType.startsWith('video/mp4') ? '.mp4' : '.webm');
    download.click();
    setTimeout(() => URL.revokeObjectURL(download.href), 30000);
    log('Movie exported.');
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    cancelAnimationFrame(frame);
    video.pause();
    if (url) URL.revokeObjectURL(url);
    stream.getTracks().forEach(track => track.stop());
    await audio.close();
  }
}
$('movie-idea').value = project.brief || '';
$('movie-idea').oninput = () => { project.brief = $('movie-idea').value; save(); renderBoard(); };
$('settings').onclick = () => { if (!busy) $('dialog').showModal(); };
$('close').onclick = () => $('dialog').close();
$('config').onsubmit = event => {
  event.preventDefault();
  apiKey = $('key').value.trim();
  $('key').value = '';
  $('dialog').close();
  notice(apiKey ? 'Gemini key set for this session. You can now generate.' : 'Gemini key cleared.');
};
const MAX_SKILL_BYTES = 32768;
let pendingSkill;
let skillSelection = 0;
$('open-skill').onclick = () => {
  if (busy) return;
  pendingSkill = null;
  $('skill-file').value = '';
  $('skill-preview').value = project.skill?.instructions || '';
  $('skill-message').textContent = project.skill ? 'Active: ' + project.skill.name : '';
  $('skill-save').disabled = true;
  $('skill-remove').hidden = !project.skill;
  $('skill-dialog').showModal();
};
$('skill-dialog').onclose = () => { skillSelection++; };
$('skill-file').onchange = async () => {
  const selection = ++skillSelection;
  const file = $('skill-file').files[0];
  pendingSkill = null;
  $('skill-save').disabled = true;
  $('skill-preview').value = project.skill?.instructions || '';
  try {
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name) || file.size > MAX_SKILL_BYTES) {
      throw Error('Choose a Markdown or plain-text file up to 32 KB.');
    }
    const instructions = (await file.text()).trim();
    if (!instructions || instructions.includes('\0')) throw Error('Choose a non-empty text skill.');
    if (selection !== skillSelection) return;
    pendingSkill = {name:file.name,instructions};
    $('skill-preview').value = instructions;
    $('skill-message').textContent = 'Ready to import ' + file.name;
    $('skill-save').disabled = false;
  } catch (error) {
    if (selection === skillSelection) $('skill-message').textContent = error.message;
  }
};
$('skill-close').onclick = () => $('skill-dialog').close();
$('skill-remove').onclick = () => {
  delete project.skill;
  save();
  renderBoard();
  if (page === 2) renderMovie();
  $('skill-dialog').close();
  log('Production skill removed.');
};
$('skill-form').onsubmit = event => {
  event.preventDefault();
  if (!pendingSkill) return;
  project.skill = pendingSkill;
  save();
  renderBoard();
  if (page === 2) renderMovie();
  $('skill-dialog').close();
  log('Production skill imported · ' + project.skill.name);
};
render();

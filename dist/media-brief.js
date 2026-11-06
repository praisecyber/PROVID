const $ = id => document.getElementById(id);
const kind = ['What would you like to create?', ['Image','Logo','Short video','Ad or product video']];
const general = [
  ['What should appear in the media?', 'Describe the subject, setting, action or text to include.'],
  ['What style and mood should it have?', 'Example: warm, cinematic, with soft lighting.'],
  ['Where will you use it?', 'Example: YouTube, Instagram Reel, or a website header. Include format or duration if relevant.']
];
const ads = [
  ['What product or service are you promoting?', 'Describe what it does, the benefits, and what viewers should see or hear.'],
  ['What kind of ad do you want?', ['UGC Ad','Podcast Clip','Testimonial','Product Demo','Transformation','Tutorial','Product Review','Unboxing']],
  ['Who is your target audience?', 'Describe your intended viewers.'],
  ['What language should the video use?', ['English','Spanish','Portuguese','Korean','Japanese','Mandarin','Indonesian']],
  ['What tone should it use?', ['Energetic','Friendly','Professional','Urgent']],
  ['What is the product link? (Optional)', 'https://example.com/product']
];
let step = 0;
let answers = [];
const isAd = () => answers[0] === 'Ad or product video';
const questions = () => [kind, ...(isAd() ? ads : general)];
function showQuestion() {
  const list = questions();
  const [question, choices] = list[step];
  const label = document.createElement('label');
  label.textContent = 'Question ' + (step + 1) + ' of ' + (step ? list.length : 'the brief') + ' · ' + question;
  const input = document.createElement(Array.isArray(choices) ? 'select' : 'textarea');
  input.id = 'media-answer';
  if (Array.isArray(choices)) {
    for (const choice of choices) input.add(new Option(choice,choice));
  } else {
    input.placeholder = choices;
    input.maxLength = 2000;
    input.required = !(isAd() && step === list.length - 1);
  }
  if (answers[step] !== undefined) input.value = answers[step];
  label.append(input);
  $('media-question').replaceChildren(label);
  $('media-result').hidden = true;
  $('media-back').hidden = step === 0;
  $('media-next').hidden = false;
  $('media-next').textContent = step === list.length - 1 ? 'Build brief' : 'Continue';
  input.focus();
}
function finish() {
  const fields = isAd() ? ['Product','Ad format','Audience','Language','Tone','Product link'] : ['Content','Style and mood','Platform and format'];
  $('media-brief').value = ['Create a ' + answers[0].toLowerCase() + '.', ...fields.map((field,index) => answers[index + 1] && field + ': ' + answers[index + 1]).filter(Boolean)].join('\n\n');
  $('media-launch').href = isAd() ? 'https://manymotions.com/marketing' : 'https://manymotions.com/dashboard/media-forge';
  $('media-question').replaceChildren();
  $('media-next').hidden = true;
  $('media-result').hidden = false;
  $('media-status').textContent = 'Copy this brief and paste it into ManyMotions.';
  $('media-copy').focus();
}
$('open-media').onclick = () => {
  step = 0;
  answers = [];
  $('media-dialog').showModal();
  showQuestion();
};
$('media-close').onclick = () => $('media-dialog').close();
$('media-back').onclick = () => {
  if ($('media-result').hidden) step--;
  showQuestion();
};
$('media-form').onsubmit = event => {
  event.preventDefault();
  const input = $('media-answer');
  if (!input) return;
  const value = input.value.trim();
  if (input.required && !value) {
    input.reportValidity();
    return;
  }
  if (step === 0 && value !== answers[0]) answers = [];
  answers[step] = value;
  if (step === questions().length - 1) return finish();
  step++;
  showQuestion();
};
$('media-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('media-brief').value);
    $('media-status').textContent = 'Brief copied. Open ManyMotions and paste it there.';
  } catch {
    $('media-brief').select();
    $('media-status').textContent = 'Brief selected. Use your device’s copy command.';
  }
};

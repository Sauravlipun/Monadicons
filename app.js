const API_BASE = 'https://api.dicebear.com/9.x';

const seedEl = document.getElementById('seed');
const styleEl = document.getElementById('style');
const bgTypeEl = document.getElementById('bgType');
const bgColorEl = document.getElementById('bgColor');
const sizeEl = document.getElementById('size');
const previewBox = document.getElementById('previewBox');
const previewMeta = document.getElementById('previewMeta');
const examplesEl = document.getElementById('examples');

const sampleSeeds = ['aurora','lumen','nova','zephyr','sol','aero','pixel','nebula','miso','sora','echo','boreal'];

function buildUrl(seedOverride) {
  const style = styleEl.value;
  const seed = encodeURIComponent((seedOverride || seedEl.value) || 'anon');
  const size = parseInt(sizeEl.value) || 512;
  const bg = bgTypeEl.value;
  const color = bgColorEl.value.replace('#','');
  let url = `${API_BASE}/${style}/svg?seed=${seed}&size=${size}`;
  if (bg === 'solid') url += `&backgroundType=solid&backgroundColor=${color}`;
  return url;
}

async function fetchSvgText(seedOverride) {
  if (styleEl.value === 'jdenticon') {
    const svg = jdenticon.toSvg((seedOverride || seedEl.value) || 'anon', parseInt(sizeEl.value)||512);
    return svg;
  }
  const url = buildUrl(seedOverride);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch SVG');
  return await res.text();
}

async function renderPreview(seedOverride) {
  try {
    previewBox.innerHTML = 'Loading...';
    const svg = await fetchSvgText(seedOverride);
    previewBox.innerHTML = svg.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    previewMeta.textContent = `Style: ${styleEl.value} • Seed: ${seedOverride || seedEl.value} • Size: ${sizeEl.value}px`;
  } catch (err) {
    previewBox.textContent = 'Preview error';
    previewMeta.textContent = '';
    console.error(err);
  }
}

document.getElementById('random').addEventListener('click', ()=>{
  const pick = sampleSeeds[Math.floor(Math.random()*sampleSeeds.length)];
  seedEl.value = pick + '-' + Math.floor(Math.random()*9999);
  renderPreview();
});

document.getElementById('downloadSvg').addEventListener('click', async ()=>{
  const svg = await fetchSvgText();
  const blob = new Blob([svg], {type:'image/svg+xml'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(seedEl.value||'icon')}.svg`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('downloadPng').addEventListener('click', async ()=>{
  const svg = await fetchSvgText();
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  img.onload = ()=>{
    const s = parseInt(sizeEl.value)||512;
    const canvas = document.createElement('canvas');
    canvas.width = s; canvas.height = s;
    const ctx = canvas.getContext('2d');
    if (bgTypeEl.value === 'solid') { ctx.fillStyle = bgColorEl.value; ctx.fillRect(0,0,s,s); }
    ctx.drawImage(img,0,0,s,s);
    canvas.toBlob((b)=>{
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `${(seedEl.value||'icon')}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

document.getElementById('copyEmbed').addEventListener('click', ()=>{
  const url = buildUrl();
  const tag = `<img src="${url}" alt="${seedEl.value||'icon'}" width="${sizeEl.value||512}" height="${sizeEl.value||512}" />`;
  navigator.clipboard.writeText(tag)
    .then(()=>alert('Embed tag copied!'))
    .catch(()=>alert('Copy failed'));
});

function renderExamples(){
  examplesEl.innerHTML = '';
  for (let s of sampleSeeds){
    const chip = document.createElement('div');
    chip.className='chip';
    chip.textContent=s;
    chip.onclick=()=>{ seedEl.value=s; renderPreview(); };
    examplesEl.appendChild(chip);
  }
}

[seedEl,styleEl,bgTypeEl,bgColorEl,sizeEl].forEach(el=>{
  el.addEventListener('input', ()=>renderPreview());
});

renderExamples();
renderPreview();

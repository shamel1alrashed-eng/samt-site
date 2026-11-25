'use strict';
const byId = id => document.getElementById(id);
const camera = byId('camera'), first = byId('first'), second = byId('second');
const stage = byId('stage'), photos = byId('photos'), split = byId('split'), statusText = byId('status');
const labels = new Map(), images = new Map();
let revision = 0;

function selectPreset(select, value, fallback) {
  select.value = labels.has(value) ? value : fallback;
}

function readLocation() {
  const query = new URL(location.href).searchParams;
  const view = query.get('camera');
  camera.value = [...camera.options].some(o => o.value === view) ? view : '02';
  selectPreset(first, query.get('a') || query.get('light'), 'majlis_normal');
  selectPreset(second, query.get('b') || query.get('ref') || query.get('reference'), first.value === 'all_on' ? 'majlis_normal' : 'all_on');
}

function loadImage(row, side) {
  const image = new Image();
  image.alt = camera.selectedOptions[0].text + '، ' + labels.get(row.preset);
  image.className = side;
  image.src = row.path;
  return image.decode().then(() => {
    if (image.naturalWidth !== row.width || image.naturalHeight !== row.height) throw Error('Unexpected size');
    return image;
  });
}

async function display(updateUrl) {
  const token = ++revision;
  const cam = camera.value, a = first.value, b = second.value;
  if (updateUrl) {
    const url = new URL(location.href);
    url.search = new URLSearchParams({camera:cam, a, b});
    history.replaceState(null, '', url);
  }
  stage.setAttribute('aria-busy','true');
  statusText.textContent = 'جارٍ تحميل المقارنة…';
  try {
    const pair = await Promise.all([loadImage(images.get(cam+'/'+a),'right-photo'),loadImage(images.get(cam+'/'+b),'left-photo')]);
    if (token !== revision) return;
    photos.replaceChildren(...pair);
    byId('rlabel').textContent = labels.get(a);
    byId('llabel').textContent = labels.get(b);
    byId('overlay').hidden = false;
    statusText.textContent = a === b ? 'اختر إضاءة مختلفة لمشاهدة الفرق.' : '';
  } catch {
    if (token !== revision) return;
    photos.replaceChildren();
    byId('overlay').hidden = true;
    statusText.textContent = 'تعذّر تحميل الصور. حدّث الصفحة لإعادة المحاولة.';
  } finally {
    if (token === revision) stage.setAttribute('aria-busy','false');
  }
}

async function start() {
  const response = await fetch('night.json?v=1');
  if (!response.ok) throw Error('Gallery unavailable');
  const data = await response.json();
  for (const c of data.cameras) camera.add(new Option(c.label,c.id));
  for (const p of data.presets) labels.set(p.id,p.label);
  for (const select of [first,second]) {
    const groups = new Map();
    for (const p of data.presets) {
      if (!groups.has(p.group)) {
        const group = document.createElement('optgroup'); group.label = p.group;
        groups.set(p.group,group); select.append(group);
      }
      groups.get(p.group).append(new Option(p.label,p.id));
    }
  }
  for (const row of data.images) images.set(row.camera+'/'+row.preset,row);
  readLocation();
  for (const select of [camera,first,second]) {
    select.disabled = false; select.addEventListener('change',() => display(true));
  }
  split.addEventListener('input',() => stage.style.setProperty('--split',split.value+'%'));
  window.addEventListener('popstate',() => { readLocation(); display(false); });
  await display(false);
}
start().catch(() => { stage.setAttribute('aria-busy','false'); statusText.textContent = 'تعذّر فتح المعاينة. حدّث الصفحة لإعادة المحاولة.'; });

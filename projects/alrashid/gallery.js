'use strict';

const $ = id => document.getElementById(id);
const qualityTiers = {
  low: {field: 'small', width: 720, height: 480},
  medium: {field: 'path', width: 1440, height: 960},
  high: {field: 'high', width: 6000, height: 4000}
};
const arabic = new Intl.NumberFormat('ar-SA', {useGrouping: false});
const percentage = new Intl.NumberFormat('ar-SA', {style: 'percent', maximumFractionDigits: 1});
const dayId = 'daylight';
const groups = {interior: 'الصالة', exterior: 'الفناء'};
const dataIndex = items => new Map(items.map(item => [item.id, item]));

function fillSelect(select, items, groupName = value => value) {
  const groups = new Map();
  select.replaceChildren();
  for (const item of items) {
    const label = groupName(item.group);
    if (label && !groups.has(label)) {
      const group = document.createElement('optgroup');
      group.label = label;
      groups.set(label, group);
      select.append(group);
    }
    (groups.get(label) || select).append(new Option(item.label, item.id));
  }
}

async function jsonFile(path) {
  const response = await fetch(path, {cache: 'no-cache'});
  if (!response.ok) throw new Error('Failed to load ' + path);
  return response.json();
}

async function loadImage(path, expected) {
  const image = new Image();
  image.src = path;
  await image.decode();
  if (expected && (image.naturalWidth !== expected.width || image.naturalHeight !== expected.height)) {
    throw new Error('Unexpected render dimensions');
  }
  return image;
}

function setSeam(frame, range) {
  frame.style.setProperty('--cut', range.value + '%');
  range.setAttribute('aria-valuetext', arabic.format(range.value) + ' بالمئة للصورة اليسرى');
}

function showCircuits(preset, families) {
  const body = $('circuitBody');
  body.replaceChildren();
  $('circuits').hidden = preset.id === dayId;
  if ($('circuits').hidden) return;
  const active = Object.entries(preset.weights || {}).filter(([id, level]) => id !== 'environment' && level > 0);
  if (preset.description || !active.length) {
    const description = document.createElement('p');
    description.textContent = preset.description || 'جميع المصابيح مطفأة. يظهر ضوء السماء الليلي.';
    body.append(description);
  }
  if (!active.length) return;
  const list = document.createElement('ul');
  for (const [id, level] of active) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    const value = document.createElement('bdi');
    name.textContent = families[id]?.label || families[id] || id;
    value.textContent = percentage.format(level);
    row.append(name, value);
    list.append(row);
  }
  body.append(list);
}

function prepareRealism() {
  let loaded = false;
  $('realism').addEventListener('toggle', async () => {
    if (!$('realism').open || loaded) return;
    loaded = true;
    try {
      const pairs = await jsonFile('comparisons.json');
      const figures = pairs.map(pair => {
        const figure = document.createElement('figure');
        const title = document.createElement('h3');
        title.textContent = pair.label;
        const frame = document.createElement('div');
        frame.className = 'frame';
        for (const [key, label] of [['after', 'بعد المعالجة'], ['before', 'قبل المعالجة']]) {
          const image = document.createElement('img');
          image.alt = pair.label + '، ' + label;
          image.srcset = pair[key].small + ' 720w, ' + pair[key].path + ' 1440w';
          image.sizes = '(max-width:780px) 94vw, 44vw';
          image.src = pair[key].path;
          if (key === 'before') image.className = 'reference';
          frame.append(image);
        }
        for (const [name, text] of [['tag tag-a', 'قبل'], ['tag tag-b', 'بعد'], ['seam', '']]) {
          const mark = document.createElement('span');
          mark.className = name;
          mark.textContent = text;
          mark.setAttribute('aria-hidden', 'true');
          frame.append(mark);
        }
        const range = document.createElement('input');
        range.className = 'wipe';
        range.type = 'range';
        range.dir = 'ltr';
        range.value = '50';
        range.setAttribute('aria-label', 'مقارنة معالجة ' + pair.label);
        range.addEventListener('input', () => setSeam(frame, range));
        setSeam(frame, range);
        frame.append(range);
        figure.append(title, frame);
        return figure;
      });
      $('realismPairs').replaceChildren(...figures);
    } catch {
      loaded = false;
      $('realismPairs').textContent = 'تعذّر تحميل المقارنة. أغلقها وافتحها للمحاولة من جديد.';
    }
  });
}

async function init() {
  const data = await jsonFile('lighting.json');
  const cameras = dataIndex(data.cameras);
  const presets = dataIndex(data.presets);
  const images = new Map(data.images.map(image => [image.camera + '/' + image.preset, image]));
  const row = (camera, light) => images.get(camera + '/' + light);
  const query = new URLSearchParams(location.search);
  let camera = cameras.has(query.get('camera')) ? query.get('camera') : data.cameras[0].id;
  let light = row(camera, query.get('light')) ? query.get('light') : row(camera, dayId) ? dayId : data.default_preset;
  let lastNight = light === dayId ? 'evening' : light;
  let reference = query.get('ref') || (light === dayId ? lastNight : dayId);
  let quality = Object.hasOwn(qualityTiers, query.get('quality')) ? query.get('quality') : 'medium';
  let request = 0;
  const angleButtons = new Map();
  $('compare').checked = Boolean(query.get('ref') && row(camera, reference) && reference !== light);
  if (query.has('split') && /^\d{1,3}$/.test(query.get('split'))) {
    $('reveal').value = String(Math.min(100, Number(query.get('split'))));
  }
  fillSelect($('camera'), data.cameras, value => groups[value] || value);
  fillSelect($('preset'), data.presets.filter(p => p.id !== dayId));
  fillSelect($('referenceMode'), data.presets);

  function urlForSelection() {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('camera', camera);
    url.searchParams.set('light', light);
    if (quality !== 'medium') url.searchParams.set('quality', quality);
    if ($('compare').checked) {
      url.searchParams.set('ref', reference);
      if ($('reveal').value !== '50') url.searchParams.set('split', $('reveal').value);
    }
    return url;
  }

  async function update() {
    const serial = ++request;
    const current = row(camera, light);
    const comparing = $('compare').checked;
    if (!row(camera, reference) || light === reference) {
      const preferred = light === dayId ? lastNight : dayId;
      reference = row(camera, preferred) && preferred !== light ? preferred :
        data.presets.find(p => p.id !== light && row(camera, p.id)).id;
    }
    const alternate = row(camera, reference);
    const highReady = Boolean(current.high && (!comparing || alternate.high));
    if (quality === 'high' && !highReady) quality = 'medium';
    const tier = qualityTiers[quality];
    const isDay = light === dayId;
    $('camera').value = camera;
    $('day').disabled = !row(camera, dayId);
    $('day').setAttribute('aria-pressed', String(isDay));
    $('night').setAttribute('aria-pressed', String(!isDay));
    $('presetField').hidden = isDay;
    $('preset').value = isDay ? lastNight : light;
    for (const button of document.querySelectorAll('[data-quality]')) {
      button.disabled = button.dataset.quality === 'high' && !highReady;
      button.setAttribute('aria-pressed', String(button.dataset.quality === quality));
    }
    $('resolution').textContent = arabic.format(tier.width) + ' × ' + arabic.format(tier.height) + ' بكسل' +
      (highReady ? '' : comparing ? ' · العالية قيد التجهيز لهذه المقارنة' : ' · العالية قيد التجهيز لهذا المشهد');
    $('referenceMode').value = reference;
    for (const option of $('referenceMode').options) option.disabled = option.value === light || !row(camera, option.value);
    $('comparisonField').hidden = !comparing;
    for (const [id, button] of angleButtons) button.setAttribute('aria-pressed', String(id === camera));
    showCircuits(presets.get(light), data.families);
    history.replaceState(null, '', urlForSelection());
    $('frame').setAttribute('aria-busy', 'true');
    $('full').hidden = true;
    $('status').replaceChildren();
    for (const id of ['reference', 'labelA', 'labelB', 'reveal', 'seam']) $(id).hidden = true;
    if (!comparing) {
      $('reference').removeAttribute('src');
      $('reference').alt = '';
    }
    // Labels and both images change together so rapid selection cannot compare unrelated frames.
    const pending = setTimeout(() => {
      if (request === serial) $('status').textContent = 'جارٍ تحميل المشهد…';
    }, 380);
    try {
      const [base, second] = await Promise.all([
        loadImage(current[tier.field], tier), comparing ? loadImage(alternate[tier.field], tier) : null
      ]);
      if (serial !== request) return;
      const label = cameras.get(camera).label;
      $('hero').src = base.src;
      $('hero').alt = label + '، ' + presets.get(light).label;
      $('shotName').textContent = label;
      $('shotInfo').textContent = (isDay ? '' : 'ليلًا · ') + presets.get(light).label;
      $('full').href = base.src;
      $('full').hidden = false;
      if (second) {
        $('reference').src = second.src;
        $('reference').alt = label + '، ' + presets.get(reference).label;
        $('labelA').textContent = presets.get(reference).label;
        $('labelB').textContent = presets.get(light).label;
        for (const id of ['reference', 'labelA', 'labelB', 'reveal', 'seam']) $(id).hidden = false;
      }
      $('status').replaceChildren();
    } catch {
      if (request !== serial) return;
      $('hero').removeAttribute('src');
      $('shotName').textContent = cameras.get(camera).label;
      $('shotInfo').textContent = '';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'إعادة تحميل الصورة';
      retry.addEventListener('click', update);
      $('status').replaceChildren('تعذّر تحميل الصورة. ', retry);
    } finally {
      clearTimeout(pending);
      if (request === serial) $('frame').setAttribute('aria-busy', 'false');
    }
  }

  function chooseCamera(id) {
    camera = id;
    if (!row(camera, light)) light = data.default_preset;
    update();
  }
  for (const item of data.cameras) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'angle';
    const photo = document.createElement('img');
    photo.alt = '';
    photo.loading = 'lazy';
    photo.width = 240;
    photo.height = 160;
    photo.src = (row(item.id, dayId) || row(item.id, 'evening')).small;
    const label = document.createElement('span');
    label.textContent = item.label;
    button.append(photo, label);
    button.addEventListener('click', () => {
      chooseCamera(item.id);
      $('frame').scrollIntoView({block: 'start'});
    });
    angleButtons.set(item.id, button);
    $('angles').append(button);
  }
  $('camera').addEventListener('change', event => chooseCamera(event.target.value));
  $('day').addEventListener('click', () => { light = dayId; update(); });
  $('night').addEventListener('click', () => { light = lastNight; update(); });
  $('preset').addEventListener('change', event => { light = lastNight = event.target.value; update(); });
  $('referenceMode').addEventListener('change', event => { reference = event.target.value; update(); });
  $('compare').addEventListener('change', update);
  document.querySelector('.quality').addEventListener('click', event => {
    const button = event.target.closest('[data-quality]');
    if (button && !button.disabled) { quality = button.dataset.quality; update(); }
  });
  $('reveal').addEventListener('input', () => setSeam($('frame'), $('reveal')));
  $('reveal').addEventListener('change', () => history.replaceState(null, '', urlForSelection()));
  setSeam($('frame'), $('reveal'));
  $('share').addEventListener('click', async () => {
    const url = urlForSelection().href;
    if (navigator.share) {
      try { await navigator.share({title: 'منزل الراشد | سمت', url}); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      $('status').textContent = 'نُسخ رابط المشهد.';
    } catch {
      $('shareText').value = url;
      $('shareDialog').showModal();
      $('shareText').select();
    }
  });
  // Keep an already-open client review in sync while native renders arrive.
  if (data.images.some(image => !image.high)) {
    let busy = false;
    const refresh = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const fresh = await jsonFile('lighting.json');
        let visibleChange = false;
        for (const item of fresh.images) {
          const prior = row(item.camera, item.preset);
          if (!prior || prior.high !== item.high) {
            images.set(item.camera + '/' + item.preset, item);
            visibleChange ||= item.camera === camera && (item.preset === light || item.preset === reference);
          }
        }
        if (visibleChange) await update();
        if (fresh.images.length === cameras.size * presets.size && fresh.images.every(item => item.high)) {
          clearInterval(timer);
          document.removeEventListener('visibilitychange', refresh);
        }
      } catch {
        // A transient connection failure must not interrupt the selected photograph.
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(refresh, 120000);
    document.addEventListener('visibilitychange', refresh);
  }
  prepareRealism();
  await update();
}
init().catch(() => { $('status').textContent = 'تعذّر فتح المعرض. أعد تحميل الصفحة للمحاولة من جديد.'; });

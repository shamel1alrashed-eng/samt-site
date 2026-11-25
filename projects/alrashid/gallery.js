// Keep previously shared camera links pointing to the corresponding approved photograph.
const url = new URL(location.href);
const camera = url.searchParams.get('camera');
const photo = camera && document.getElementById('gallery-' + camera.padStart(2, '0'));
const light = url.searchParams.get('light');
const reference = url.searchParams.get('ref');
if ((light && light !== 'daylight') || (reference && reference !== 'daylight')) {
  const compare = new URL('/view/alrashid-compare/', location.origin);
  if (camera) compare.searchParams.set('camera',camera);
  if (light && light !== 'daylight') compare.searchParams.set('a',light);
  if (reference && reference !== 'daylight') compare.searchParams.set('b',reference);
  location.replace(compare);
} else if (url.search) {
  url.search = '';
  if (photo && !url.hash) url.hash = photo.id;
  history.replaceState(null, '', url);
  if (photo && url.hash === '#' + photo.id) photo.scrollIntoView();
}

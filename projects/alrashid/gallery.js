// Keep previously shared camera links pointing to the corresponding approved photograph.
const url = new URL(location.href);
const camera = url.searchParams.get('camera');
const photo = camera && document.getElementById('gallery-' + camera.padStart(2, '0'));
if (url.search) {
  url.search = '';
  if (photo && !url.hash) url.hash = photo.id;
  history.replaceState(null, '', url);
  if (photo && url.hash === '#' + photo.id) photo.scrollIntoView();
}

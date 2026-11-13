// Only the small JPEG produced by the upload control is persisted.
export const MAX_PHOTO_LENGTH = 350000;
export function validPhoto(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || value.length > MAX_PHOTO_LENGTH || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    const bytes = atob(value.slice(23));
    return bytes.length > 4 && bytes.charCodeAt(0) === 255 && bytes.charCodeAt(1) === 216
      && bytes.charCodeAt(2) === 255 && bytes.charCodeAt(bytes.length - 2) === 255 && bytes.charCodeAt(bytes.length - 1) === 217;
  } catch { return false; }
}

export async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error('This photo could not be opened. Try another image.'); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) {
      throw new Error('Choose a photo with fewer than 40 megapixels.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 400, 400);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 400, 400);
    const data = canvas.toDataURL('image/jpeg', .85);
    if (!validPhoto(data)) throw new Error('This photo could not be processed. Try another image.');
    return data;
  } finally { URL.revokeObjectURL(url); }
}

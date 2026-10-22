import type { Raster } from '../core/image/raster';
import type { ProjectImage } from '../core/sight/model';

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
/** Stored copy of the image is limited to keep projects small in IndexedDB. */
const STORE_MAX_SIDE = 1024;
/** Raster handed to the tracer (it downsizes further to its own work size). */
const RASTER_MAX_SIDE = 768;

export function isAcceptedFile(f: File): boolean {
  if (ACCEPTED_TYPES.includes(f.type)) return true;
  return /\.(png|jpe?g|webp)$/i.test(f.name);
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function scaledCanvas(img: HTMLImageElement, maxSide: number) {
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { c, ctx };
}

/** Read a user file into a storable (downscaled, PNG to keep alpha) project image. */
export async function fileToProjectImage(file: File): Promise<ProjectImage> {
  const original = await readAsDataUrl(file);
  const img = await loadImageElement(original);
  let dataUrl = original;
  if (Math.max(img.naturalWidth, img.naturalHeight) > STORE_MAX_SIDE || file.size > 1.5e6) {
    const { c } = scaledCanvas(img, STORE_MAX_SIDE);
    const hasAlpha = file.type !== 'image/jpeg';
    dataUrl = hasAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92);
  }
  return { dataUrl, fileName: file.name, width: img.naturalWidth, height: img.naturalHeight };
}

export async function urlToFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}

export function imageToRaster(img: HTMLImageElement): Raster {
  const { c, ctx } = scaledCanvas(img, RASTER_MAX_SIDE);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: d.width, height: d.height, data: d.data };
}

export function maskToDataUrl(mask: { width: number; height: number; data: Uint8Array }, rgb: [number, number, number]): string {
  const c = document.createElement('canvas');
  c.width = mask.width;
  c.height = mask.height;
  const ctx = c.getContext('2d')!;
  const id = ctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    if (!mask.data[i]) continue;
    id.data[i * 4] = rgb[0];
    id.data[i * 4 + 1] = rgb[1];
    id.data[i * 4 + 2] = rgb[2];
    id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}

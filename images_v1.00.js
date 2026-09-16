// Only session-memory Blob URLs are created. Nothing is uploaded or persisted.
export const MAX_PHOTOS = 30;
export const PIXEL_BUDGET = 48_000_000;
const MAX_EDGE = 2400;
const MAX_FILE_BYTES = 40 * 1024 * 1024;

export function pixelLimit(count) {
  return Math.min(4_000_000, Math.floor(PIXEL_BUDGET / Math.max(1, count)));
}

export async function decodeImage(src) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  try {
    await image.decode();
    return image;
  } catch (error) {
    image.removeAttribute("src");
    throw error;
  }
}

export async function preparePhoto(file, maxPixels) {
  // SVG is not a camera photo and can reference external resources; keep the supported input raster-only.
  if (file.size > MAX_FILE_BYTES) throw new Error("large");
  if (
    file.type === "image/svg+xml" ||
    /\.svgz?$/i.test(file.name) ||
    (file.type && !file.type.startsWith("image/"))
  )
    throw new Error("format");
  const sourceURL = URL.createObjectURL(file);
  let image;
  let canvas;
  try {
    image = await decodeImage(sourceURL);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > 64_000_000)
      throw new Error("large");
    // Modern Safari applies EXIF during image decoding. Canvas bakes that orientation in once.
    const ratio = Math.min(
      1,
      MAX_EDGE / Math.max(width, height),
      Math.sqrt(maxPixels / (width * height)),
    );
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("memory");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.95),
    );
    if (!blob) throw new Error("memory");
    const src = URL.createObjectURL(blob);
    try {
      const check = await decodeImage(src);
      check.removeAttribute("src");
    } catch (error) {
      URL.revokeObjectURL(src);
      throw error;
    }
    return { src, naturalWidth: canvas.width, naturalHeight: canvas.height };
  } finally {
    image?.removeAttribute("src");
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    URL.revokeObjectURL(sourceURL);
  }
}

export function releasePhoto(photo) {
  URL.revokeObjectURL(photo.src);
}

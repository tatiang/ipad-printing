export const VERSION = "v1.00";
export const LAYOUTS = {
  1: [1, 1],
  2: [1, 2],
  4: [2, 2],
  6: [2, 3],
  9: [3, 3],
};
export const PAPER = { width: 8.5, height: 11, margin: 0.25, gap: 0.15 };
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function layoutGeometry(count, orientation = "portrait") {
  if (!LAYOUTS[count]) throw new Error("Unknown layout");
  const [columns, rows] = LAYOUTS[count];
  const { margin, gap } = PAPER;
  const width = orientation === "landscape" ? PAPER.height : PAPER.width;
  const height = orientation === "landscape" ? PAPER.width : PAPER.height;
  return {
    width,
    height,
    columns,
    rows,
    margin,
    gap,
    cellWidth: (width - 2 * margin - (columns - 1) * gap) / columns,
    cellHeight: (height - 2 * margin - (rows - 1) * gap) / rows,
  };
}

export function paginate(photos, count) {
  if (!LAYOUTS[count]) throw new Error("Unknown layout");
  return Array.from({ length: Math.ceil(photos.length / count) }, (_, page) =>
    photos.slice(page * count, (page + 1) * count),
  );
}

// Offsets are fractions of available travel, so changing layouts cannot expose blank space.
export function cropGeometry(photo, frameWidth, frameHeight) {
  const quarterTurn = photo.rotation % 180 !== 0;
  const rotatedWidth = quarterTurn ? photo.naturalHeight : photo.naturalWidth;
  const rotatedHeight = quarterTurn ? photo.naturalWidth : photo.naturalHeight;
  const scale =
    Math.max(frameWidth / rotatedWidth, frameHeight / rotatedHeight) *
    clamp(photo.scale, 1, 4);
  const maxX = Math.max(0, (rotatedWidth * scale - frameWidth) / 2);
  const maxY = Math.max(0, (rotatedHeight * scale - frameHeight) / 2);
  return {
    width: photo.naturalWidth * scale,
    height: photo.naturalHeight * scale,
    maxX,
    maxY,
    x: clamp(photo.offsetX, -1, 1) * maxX,
    y: clamp(photo.offsetY, -1, 1) * maxY,
  };
}

export function setCropPosition(photo, x, y, frameWidth, frameHeight) {
  const { maxX, maxY } = cropGeometry(photo, frameWidth, frameHeight);
  photo.offsetX = maxX > 0 ? clamp(x / maxX, -1, 1) : 0;
  photo.offsetY = maxY > 0 ? clamp(y / maxY, -1, 1) : 0;
}

export function movePhoto(photos, id, direction) {
  const index = photos.findIndex((photo) => photo.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= photos.length) return false;
  [photos[index], photos[target]] = [photos[target], photos[index]];
  return true;
}

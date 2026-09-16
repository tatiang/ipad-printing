import test from "node:test";
import assert from "node:assert/strict";
import {
  LAYOUTS,
  layoutGeometry,
  paginate,
  cropGeometry,
  setCropPosition,
  movePhoto,
} from "../geometry_v1.00.mjs";

for (const count of Object.keys(LAYOUTS).map(Number)) {
  test(`${count}-up: cell sizes, safe margins, gaps and page bounds`, () => {
    const g = layoutGeometry(count);
    assert.equal(g.columns * g.rows, count);
    assert.equal(g.margin, 0.25);
    assert.equal(g.width, 8.5);
    assert.equal(g.height, 11);
    assert.ok(
      Math.abs(
        2 * g.margin + g.columns * g.cellWidth + (g.columns - 1) * g.gap - 8.5,
      ) < 1e-9,
    );
    assert.ok(
      Math.abs(
        2 * g.margin + g.rows * g.cellHeight + (g.rows - 1) * g.gap - 11,
      ) < 1e-9,
    );
  });
}
test("pagination preserves reading order and leaves final slots empty", () => {
  for (const [length, count, pages] of [
    [1, 1, 1],
    [2, 2, 1],
    [4, 4, 1],
    [6, 6, 1],
    [9, 9, 1],
    [14, 9, 2],
    [10, 4, 3],
    [30, 1, 30],
    [0, 4, 0],
  ]) {
    const photos = Array.from({ length }, (_, id) => ({ id }));
    const result = paginate(photos, count);
    assert.equal(result.length, pages);
    assert.deepEqual(result.flat(), photos);
  }
});
test("every orientation and zoom covers its crop frame without distortion", () => {
  for (const count of Object.keys(LAYOUTS))
    for (const [naturalWidth, naturalHeight] of [
      [4000, 3000],
      [3000, 4000],
      [6000, 500],
      [500, 6000],
    ]) {
      const { cellWidth: w, cellHeight: h } = layoutGeometry(count);
      for (const rotation of [0, 90, 180, 270])
        for (const scale of [1, 1.3, 2, 4])
          for (const offset of [-1, 0, 1]) {
            const photo = {
              naturalWidth,
              naturalHeight,
              rotation,
              scale,
              offsetX: offset,
              offsetY: -offset,
            };
            const crop = cropGeometry(photo, w, h);
            const rw = rotation % 180 ? crop.height : crop.width;
            const rh = rotation % 180 ? crop.width : crop.height;
            assert.ok(
              crop.x - rw / 2 <= -w / 2 + 1e-9 &&
                crop.x + rw / 2 >= w / 2 - 1e-9,
            );
            assert.ok(
              crop.y - rh / 2 <= -h / 2 + 1e-9 &&
                crop.y + rh / 2 >= h / 2 - 1e-9,
            );
            assert.ok(
              Math.abs(
                crop.width / crop.height - naturalWidth / naturalHeight,
              ) < 1e-9,
            );
            setCropPosition(photo, 1e6, -1e6, w, h);
            assert.ok(
              Math.abs(photo.offsetX) <= 1 && Math.abs(photo.offsetY) <= 1,
            );
          }
    }
});
test("reorder uses stable identity and ignores out-of-range moves", () => {
  const photos = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(movePhoto(photos, "b", -1), true);
  assert.deepEqual(
    photos.map((p) => p.id),
    ["b", "a", "c"],
  );
  assert.equal(movePhoto(photos, "b", -1), false);
  assert.equal(movePhoto(photos, "missing", 1), false);
  assert.equal(movePhoto(photos, "b", 1), true);
  assert.deepEqual(
    photos.map((p) => p.id),
    ["a", "b", "c"],
  );
});
test("landscape is available to the geometry layer without changing v1 UI", () => {
  const g = layoutGeometry(4, "landscape");
  assert.equal(g.width, 11);
  assert.equal(g.height, 8.5);
});

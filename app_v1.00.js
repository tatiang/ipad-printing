import {
  LAYOUTS,
  layoutGeometry,
  paginate,
  cropGeometry,
  setCropPosition,
  clamp,
  movePhoto,
} from "./geometry_v1.00.mjs";
import {
  MAX_PHOTOS,
  pixelLimit,
  preparePhoto,
  releasePhoto,
} from "./images_v1.00.js";

const $ = (id) => document.getElementById(id);
const state = {
  photos: [],
  layout: { photosPerPage: 4, pageOrientation: "portrait" },
  cutGuides: false,
  busy: false,
  editingId: null,
};
const pointers = new Map();
let gesture = null;
let renderGeneration = 0;
let previewReady = false;
let editorReturnId = null;
const geometry = () =>
  layoutGeometry(state.layout.photosPerPage, state.layout.pageOrientation);
const editingPhoto = () =>
  state.photos.find((photo) => photo.id === state.editingId);
const announce = (text) => {
  $("status").textContent = text;
};
// randomUUID requires HTTPS; getRandomValues also supports a local-network HTTP QA server.
function createPhotoId() {
  return (
    crypto.randomUUID?.() ||
    [...crypto.getRandomValues(new Uint32Array(4))]
      .map((value) => value.toString(16).padStart(8, "0"))
      .join("-")
  );
}

function setBusy(busy) {
  state.busy = busy;
  for (const id of ["choose", "photo-input"])
    $(id).disabled = busy;
  $("reset").disabled = busy || !state.photos.length;
  $("print").disabled = busy || !state.photos.length || !previewReady;
  $("choose").textContent = busy ? "Getting photos ready…" : "＋ Choose Photos";
  $("pages").setAttribute("aria-busy", String(busy));
}

function renderLayouts() {
  for (const [count, [columns, rows]] of Object.entries(LAYOUTS)) {
    const button = document.createElement("button");
    button.className = "layout-option";
    button.dataset.count = count;
    button.disabled = Number(count) < 4;
    button.setAttribute("aria-label", `${count} photos per page`);
    const icon = document.createElement("span");
    icon.className = "layout-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    icon.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    for (let i = 0; i < Number(count); i++)
      icon.append(document.createElement("i"));
    button.append(icon, document.createTextNode(`${count} per page`));
    button.addEventListener("click", () => {
      state.layout.photosPerPage = Number(count);
      render();
    });
    $("layouts").append(button);
  }
}

function applyCrop(frame, photo) {
  const { cellWidth, cellHeight } = geometry();
  const crop = cropGeometry(photo, cellWidth, cellHeight);
  const image = frame.querySelector("img");
  image.style.width = `${(crop.width / cellWidth) * 100}%`;
  image.style.height = `${(crop.height / cellHeight) * 100}%`;
  image.style.left = `${50 + (crop.x / cellWidth) * 100}%`;
  image.style.top = `${50 + (crop.y / cellHeight) * 100}%`;
  image.style.transform = `translate(-50%, -50%) rotate(${photo.rotation}deg)`;
}

function photoImage(photo) {
  const image = document.createElement("img");
  image.src = photo.src;
  image.alt = "";
  image.draggable = false;
  return image;
}

function makeFrame(photo, index, slot, g) {
  const frame = document.createElement("button");
  frame.className = "photo-frame";
  frame.dataset.photoId = photo.id;
  frame.setAttribute("aria-label", `Adjust photo ${index + 1}`);
  const column = slot % g.columns;
  const row = Math.floor(slot / g.columns);
  Object.assign(frame.style, {
    left: `${((g.margin + column * (g.cellWidth + g.gap)) / g.width) * 100}%`,
    top: `${((g.margin + row * (g.cellHeight + g.gap)) / g.height) * 100}%`,
    width: `${(g.cellWidth / g.width) * 100}%`,
    height: `${(g.cellHeight / g.height) * 100}%`,
  });
  const number = document.createElement("span");
  number.className = "photo-number screen-only";
  number.textContent = `${index + 1} · Adjust`;
  frame.append(photoImage(photo), number);
  applyCrop(frame, photo);
  frame.addEventListener("click", () => {
    if (!state.busy) openEditor(photo.id);
  });
  return frame;
}

function addGuides(sheet, g) {
  if (!state.cutGuides) return;
  for (let column = 1; column < g.columns; column++) {
    const guide = document.createElement("span");
    guide.className = "cut-guide";
    Object.assign(guide.style, {
      left: `${((g.margin + column * (g.cellWidth + g.gap) - g.gap / 2) / g.width) * 100}%`,
      top: `${(g.margin / g.height) * 100}%`,
      height: `${((g.height - 2 * g.margin) / g.height) * 100}%`,
      borderLeftWidth: "0.5pt",
    });
    sheet.append(guide);
  }
  for (let row = 1; row < g.rows; row++) {
    const guide = document.createElement("span");
    guide.className = "cut-guide";
    Object.assign(guide.style, {
      top: `${((g.margin + row * (g.cellHeight + g.gap) - g.gap / 2) / g.height) * 100}%`,
      left: `${(g.margin / g.width) * 100}%`,
      width: `${((g.width - 2 * g.margin) / g.width) * 100}%`,
      borderTopWidth: "0.5pt",
    });
    sheet.append(guide);
  }
}

function render() {
  const count = state.photos.length;
  const groups = paginate(state.photos, state.layout.photosPerPage);
  const g = geometry();
  for (const button of $("layouts").children)
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.count) === state.layout.photosPerPage),
    );
  $("photo-count").textContent = count
    ? `${count} ${count === 1 ? "photo" : "photos"} selected · up to 30`
    : "Up to 30 photos · JPEG, PNG & more";
  $("page-count").textContent = count
    ? `${groups.length} ${groups.length === 1 ? "page" : "pages"} · US Letter`
    : "";
  $("ready-label").textContent = count
    ? `${groups.length} ${groups.length === 1 ? "page" : "pages"} to make your own.`
    : "Let’s make something.";
  $("ready-detail").textContent = count
    ? `${count} photos · ${state.layout.photosPerPage} per page · Ready when you are.`
    : "Your next project starts here.";
  $("empty").hidden = count > 0;
  $("preview-note").hidden = !count;
  $("cut-guides").checked = state.cutGuides;
  const fragment = document.createDocumentFragment();
  groups.forEach((photos, page) => {
    const wrapper = document.createElement("section");
    wrapper.className = "sheet-wrapper";
    wrapper.setAttribute("aria-label", `Page ${page + 1}`);
    const label = document.createElement("div");
    label.className = "page-label screen-only";
    label.textContent = `PAGE ${page + 1}`;
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    photos.forEach((photo, slot) =>
      sheet.append(
        makeFrame(photo, page * state.layout.photosPerPage + slot, slot, g),
      ),
    );
    addGuides(sheet, g);
    wrapper.append(label, sheet);
    fragment.append(wrapper);
  });
  $("pages").replaceChildren(fragment);
  previewReady = false;
  setBusy(state.busy);
  const generation = ++renderGeneration;
  Promise.all(
    [...$("pages").querySelectorAll("img")].map((image) => image.decode()),
  )
    .then(() => {
      if (generation !== renderGeneration) return;
      previewReady = true;
      setBusy(state.busy);
    })
    .catch(() => {
      if (generation === renderGeneration)
        announce(
          "A photo could not be prepared for printing. Remove it and choose it again.",
        );
    });
}

async function importPhotos(files) {
  if (state.busy || !files.length) return;
  const available = MAX_PHOTOS - state.photos.length;
  const selected = files.slice(0, available);
  if (!selected.length) {
    announce("Your sheet has 30 photos. Remove one to add another.");
    return;
  }
  setBusy(true);
  const maxPixels = pixelLimit(state.photos.length + selected.length);
  let failed = 0;
  let tooLarge = 0;
  let added = 0;
  try {
    // Lower the working-resolution budget before adding more photos, one decode at a time.
    for (const photo of state.photos) {
      if (photo.naturalWidth * photo.naturalHeight > maxPixels) {
        const replacement = await preparePhoto(photo.file, maxPixels);
        const oldSrc = photo.src;
        Object.assign(photo, replacement);
        for (const image of $("pages").querySelectorAll("img"))
          if (image.src === oldSrc) image.src = photo.src;
        URL.revokeObjectURL(oldSrc);
      }
    }
    for (const [index, file] of selected.entries()) {
      announce(`Getting photo ${index + 1} of ${selected.length} ready…`);
      try {
        const image = await preparePhoto(file, maxPixels);
        state.photos.push({
          id: createPhotoId(),
          file,
          ...image,
          rotation: 0,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        });
        added++;
      } catch (error) {
        failed++;
        if (error.message === "large") tooLarge++;
      }
    }
    const messages = [];
    if (added)
      messages.push(
        `${added} ${added === 1 ? "photo added" : "photos added"}. Tap a photo to make it yours.`,
      );
    if (failed)
      messages.push(
        `${failed === 1 ? "One photo couldn’t" : `${failed} photos couldn’t`} be opened. Try a JPEG or PNG${tooLarge ? " or a smaller photo" : ""}.`,
      );
    if (files.length > available)
      messages.push("You can use up to 30 photos at a time.");
    announce(messages.join(" "));
  } catch {
    announce(
      "This iPad needs a little more room. Try fewer or smaller photos.",
    );
  } finally {
    setBusy(false);
    render();
  }
}

function openEditor(id) {
  state.editingId = id;
  editorReturnId = id;
  $("edit-frame").replaceChildren(photoImage(editingPhoto()));
  $("editor").showModal();
  sizeEditor();
  updateEditor();
}

function sizeEditor() {
  if (!$("editor").open) return;
  const stage = document.querySelector(".editor-stage");
  const g = geometry();
  const width = Math.min(
    stage.clientWidth - 28,
    ((stage.clientHeight - 28) * g.cellWidth) / g.cellHeight,
  );
  $("edit-frame").style.width = `${width}px`;
  $("edit-frame").style.height = `${(width * g.cellHeight) / g.cellWidth}px`;
}

function updateEditor() {
  const photo = editingPhoto();
  if (!photo) return;
  applyCrop($("edit-frame"), photo);
  const index = state.photos.indexOf(photo);
  $("editor-title").textContent = `Adjust photo ${index + 1}`;
  $("order-label").textContent = `${index + 1} of ${state.photos.length}`;
  $("earlier").disabled = index === 0;
  $("later").disabled = index === state.photos.length - 1;
  $("zoom").value = String(photo.scale);
  $("zoom-value").value = `${Math.round(photo.scale * 100)}%`;
  $("zoom-out").disabled = photo.scale <= 1;
  $("zoom-in").disabled = photo.scale >= 4;
  // Keep the underlying print DOM current even when a browser print shortcut is used.
  const frame = [...$("pages").querySelectorAll(".photo-frame")].find(
    (element) => element.dataset.photoId === photo.id,
  );
  if (frame) applyCrop(frame, photo);
}

function zoomTo(value, anchorX = 0, anchorY = 0) {
  const photo = editingPhoto();
  if (!photo) return;
  const { cellWidth: w, cellHeight: h } = geometry();
  const before = cropGeometry(photo, w, h);
  const previousScale = photo.scale;
  photo.scale = clamp(value, 1, 4);
  const ratio = photo.scale / previousScale;
  setCropPosition(
    photo,
    anchorX + (before.x - anchorX) * ratio,
    anchorY + (before.y - anchorY) * ratio,
    w,
    h,
  );
  updateEditor();
}

function panBy(x, y) {
  const photo = editingPhoto();
  const { cellWidth: w, cellHeight: h } = geometry();
  const crop = cropGeometry(photo, w, h);
  setCropPosition(photo, crop.x + x * w, crop.y + y * h, w, h);
  updateEditor();
}

function pointerMetrics() {
  const points = [...pointers.values()];
  const a = points[0];
  const b = points[1] || a;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.hypot(a.x - b.x, a.y - b.y),
    count: points.length,
  };
}

$("edit-frame").addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  $("edit-frame").setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  gesture = pointerMetrics();
});
$("edit-frame").addEventListener("pointermove", (event) => {
  if (!pointers.has(event.pointerId)) return;
  event.preventDefault();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const next = pointerMetrics();
  const rect = $("edit-frame").getBoundingClientRect();
  const { cellWidth: w, cellHeight: h } = geometry();
  if (gesture && next.count === gesture.count) {
    if (next.count >= 2 && gesture.distance > 0) {
      zoomTo(
        (editingPhoto().scale * next.distance) / gesture.distance,
        ((gesture.x - rect.left - rect.width / 2) / rect.width) * w,
        ((gesture.y - rect.top - rect.height / 2) / rect.height) * h,
      );
    }
    panBy(
      (next.x - gesture.x) / rect.width,
      (next.y - gesture.y) / rect.height,
    );
  }
  gesture = next;
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  $("edit-frame").addEventListener(type, (event) => {
    pointers.delete(event.pointerId);
    gesture = pointers.size ? pointerMetrics() : null;
  });
$("edit-frame").addEventListener("keydown", (event) => {
  const offsets = {
    ArrowLeft: [-0.04, 0],
    ArrowRight: [0.04, 0],
    ArrowUp: [0, -0.04],
    ArrowDown: [0, 0.04],
  };
  if (offsets[event.key]) {
    event.preventDefault();
    panBy(...offsets[event.key]);
  }
  if (["+", "=", "-"].includes(event.key)) {
    event.preventDefault();
    zoomTo(editingPhoto().scale + (event.key === "-" ? -0.1 : 0.1));
  }
});
for (const button of document.querySelectorAll("[data-pan]"))
  button.addEventListener("click", () =>
    panBy(
      ...button.dataset.pan.split(",").map((value) => Number(value) * 0.05),
    ),
  );
$("zoom").addEventListener("input", () => zoomTo(Number($("zoom").value)));
$("zoom-out").addEventListener("click", () =>
  zoomTo(editingPhoto().scale - 0.15),
);
$("zoom-in").addEventListener("click", () =>
  zoomTo(editingPhoto().scale + 0.15),
);
$("rotate").addEventListener("click", () => {
  const photo = editingPhoto();
  photo.rotation = (photo.rotation + 90) % 360;
  photo.offsetX = 0;
  photo.offsetY = 0;
  updateEditor();
});
$("reset-crop").addEventListener("click", () => {
  Object.assign(editingPhoto(), {
    rotation: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  updateEditor();
});
for (const [id, direction] of [
  ["earlier", -1],
  ["later", 1],
])
  $(id).addEventListener("click", () => {
    movePhoto(state.photos, state.editingId, direction);
    render();
    updateEditor();
  });
$("done").addEventListener("click", () => $("editor").close());
$("editor").addEventListener("close", () => {
  pointers.clear();
  gesture = null;
  state.editingId = null;
  $("edit-frame").replaceChildren();
  render();
  const frame = [...$("pages").querySelectorAll(".photo-frame")].find(
    (element) => element.dataset.photoId === editorReturnId,
  );
  (frame || $("choose")).focus({ preventScroll: true });
});
$("remove").addEventListener("click", () => {
  const photo = editingPhoto();
  state.photos = state.photos.filter((item) => item.id !== photo.id);
  releasePhoto(photo);
  $("editor").close();
  announce("Photo removed. Your original is still in your library.");
});
$("photo-input").addEventListener("change", (event) => {
  const files = [...event.target.files];
  event.target.value = "";
  importPhotos(files);
});
$("choose").addEventListener("click", () => $("photo-input").click());
$("cut-guides").addEventListener("change", (event) => {
  state.cutGuides = event.target.checked;
  render();
});
$("reset").addEventListener("click", () => {
  if (state.photos.length) $("reset-dialog").showModal();
});
$("cancel-reset").addEventListener("click", () => $("reset-dialog").close());
$("confirm-reset").addEventListener("click", () => {
  for (const photo of state.photos) releasePhoto(photo);
  state.photos = [];
  state.layout.photosPerPage = 4;
  state.cutGuides = false;
  $("photo-input").value = "";
  $("reset-dialog").close();
  render();
  announce("A fresh start. Choose photos to make a new sheet.");
  $("choose").focus();
});
$("print").addEventListener("click", () => {
  if (!state.photos.length || state.busy || !previewReady) return;
  // Decoding finishes before enabling Print; call synchronously to retain Safari's user activation.
  try {
    window.print();
  } catch {
    announce(
      "Printing couldn’t open. Try opening this page in Safari, then tap Print again.",
    );
  }
});
new ResizeObserver(sizeEditor).observe(document.querySelector(".editor-stage"));
window.addEventListener("pagehide", (event) => {
  // Preserve a back/forward-cached session; real navigation/reload releases every working URL.
  if (!event.persisted) for (const photo of state.photos) releasePhoto(photo);
});
renderLayouts();
render();
if (
  "serviceWorker" in navigator &&
  (location.protocol === "https:" ||
    ["localhost", "127.0.0.1"].includes(location.hostname))
) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    announce(
      "You can keep making your sheet. Offline access isn’t available right now.",
    );
  });
}

import {
  LAYOUTS,
  layoutGeometry,
  paginate,
  cropGeometry,
  setCropPosition,
  clamp,
  movePhoto,
  copyCount,
  totalCopies,
  expandCopies,
  changePhotoCopies,
  MAX_COPIES_PER_PHOTO,
  MAX_PRINTED_PHOTOS,
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
  layout: { photosPerPage: 9, pageOrientation: "portrait" },
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
  for (const id of ["choose", "photo-input"]) $(id).disabled = busy;
  for (const button of $("layouts").children) button.disabled = busy;
  for (const button of $("photo-copies").querySelectorAll("button"))
    button.disabled = busy || button.dataset.atLimit === "true";
  $("reset").disabled = busy || !state.photos.length;
  $("print").disabled = busy || !state.photos.length || !previewReady;
  $("preparing").hidden = !busy;
  document.body.classList.toggle("is-preparing", busy);
  $("pages").setAttribute("aria-busy", String(busy));
}

function updatePreparationProgress(completed, total) {
  const maximum = Math.max(1, total);
  const current = clamp(completed, 0, maximum);
  const progress = $("preparing-progress");
  progress.setAttribute("aria-valuemax", String(maximum));
  progress.setAttribute("aria-valuenow", String(current));
  $("preparing-bar").style.width = `${(current / maximum) * 100}%`;
  $("preparing-detail").textContent =
    current < maximum
      ? `Photo ${current + 1} of ${maximum}`
      : `${maximum} ${maximum === 1 ? "photo" : "photos"} ready`;
}

function renderLayouts() {
  for (const [count, [columns, rows]] of Object.entries(LAYOUTS)) {
    const button = document.createElement("button");
    button.className = "layout-option";
    button.dataset.count = count;
    button.setAttribute("aria-label", `${count} photos per page`);
    const icon = document.createElement("span");
    icon.className = "layout-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    icon.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    for (let i = 0; i < Number(count); i++)
      icon.append(document.createElement("i"));
    const label = document.createElement("span");
    label.textContent = count;
    button.append(icon, label);
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

function renderCopyControls() {
  const total = totalCopies(state.photos);
  const fragment = document.createDocumentFragment();
  state.photos.forEach((photo, index) => {
    const row = document.createElement("div");
    row.className = "copy-row";
    row.dataset.sourceId = photo.id;
    const thumbnail = photoImage(photo);
    thumbnail.className = "copy-thumbnail";
    const details = document.createElement("div");
    details.className = "copy-name";
    const label = document.createElement("strong");
    label.textContent = `Photo ${index + 1}`;
    const caption = document.createElement("small");
    caption.textContent = "Copies";
    details.append(label, caption);
    const stepper = document.createElement("div");
    stepper.className = "copy-stepper";
    for (const delta of [-1, 1]) {
      if (delta === 1) {
        const output = document.createElement("output");
        output.textContent = String(copyCount(photo));
        output.setAttribute("aria-label", `Copies of photo ${index + 1}`);
        stepper.append(output);
      }
      const button = document.createElement("button");
      button.className = "button secondary";
      button.textContent = delta === 1 ? "+" : "−";
      button.dataset.delta = String(delta);
      button.setAttribute(
        "aria-label",
        `${delta === 1 ? "Increase" : "Decrease"} copies of photo ${index + 1}`,
      );
      button.dataset.atLimit = String(
        delta === -1
          ? copyCount(photo) === 1
          : copyCount(photo) === MAX_COPIES_PER_PHOTO ||
              total === MAX_PRINTED_PHOTOS,
      );
      stepper.append(button);
    }
    row.append(thumbnail, details, stepper);
    fragment.append(row);
  });
  $("photo-copies").replaceChildren(fragment);
  $("copies-limit").hidden = total < MAX_PRINTED_PHOTOS;
}

function changeCopies(id, delta, fromSidebar = false) {
  if (state.busy || !changePhotoCopies(state.photos, id, delta)) return;
  const index = state.photos.findIndex((photo) => photo.id === id);
  const photo = state.photos[index];
  const message = `Photo ${index + 1}: ${copyCount(photo)} ${copyCount(photo) === 1 ? "copy" : "copies"}. ${totalCopies(state.photos)} photos to print.`;
  const sidebarFocus = fromSidebar
    ? id
    : document.activeElement.closest(".copy-row")?.dataset.sourceId;
  render();
  if (state.editingId) updateEditor();
  announce(message);
  $("editor-copy-status").textContent = message;
  if (sidebarFocus) {
    const row = [...$("photo-copies").children].find(
      (item) => item.dataset.sourceId === sidebarFocus,
    );
    const buttons = [...row.querySelectorAll("button")];
    (
      buttons.find(
        (button) => Number(button.dataset.delta) === delta && !button.disabled,
      ) || buttons.find((button) => !button.disabled)
    )?.focus({ preventScroll: true });
  }
}

function render() {
  const count = state.photos.length;
  const total = totalCopies(state.photos);
  const groups = paginate(
    expandCopies(state.photos),
    state.layout.photosPerPage,
  );
  const g = geometry();
  for (const button of $("layouts").children)
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.count) === state.layout.photosPerPage),
    );
  $("photo-count").textContent = count
    ? `${count} of ${MAX_PHOTOS} photos chosen · ${total} to print`
    : `Choose up to ${MAX_PHOTOS} photos.`;
  document.body.classList.toggle("has-photos", count > 0);
  $("workspace").hidden = !count;
  $("print-bar").hidden = !count;
  $("intro-kicker").textContent = count
    ? "PHOTOS CHOSEN · NEXT, SET YOUR COPIES"
    : "START HERE · STEP 1";
  $("intro-title").textContent = count
    ? "Make a copy for everyone."
    : "First, choose your photos.";
  $("picker-title").textContent = count
    ? "Need another photo?"
    : "Tap the green button to get started.";
  $("picker-help").textContent = count
    ? "Use the same button to choose more from your library."
    : "Your iPad’s photo library will open so you can pick what to print.";
  $("choose-label").textContent = count ? "Add More Photos" : "Choose Photos";
  renderCopyControls();
  $("page-count").textContent = count
    ? `${groups.length} ${groups.length === 1 ? "page" : "pages"} · US Letter`
    : "";
  $("ready-label").textContent = count
    ? `${total} ${total === 1 ? "photo" : "photos"} to print`
    : "Add photos to begin";
  $("ready-detail").textContent = count
    ? `${groups.length} ${groups.length === 1 ? "page" : "pages"} · ${state.layout.photosPerPage} per page`
    : "Nothing leaves this iPad.";
  const journey = document.querySelectorAll(".journey li");
  journey.forEach((step) => step.classList.remove("current", "done"));
  if (count) {
    journey[0].classList.add("done");
    journey[1].classList.add("current");
  } else {
    journey[0].classList.add("current");
  }
  $("empty").hidden = count > 0;
  $("preview-note").hidden = !count;
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
      sheet.append(makeFrame(photo, state.photos.indexOf(photo), slot, g)),
    );
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
  const available = Math.min(
    MAX_PHOTOS - state.photos.length,
    MAX_PRINTED_PHOTOS - totalCopies(state.photos),
  );
  const selected = files.slice(0, available);
  if (!selected.length) {
    announce(
      state.photos.length >= MAX_PHOTOS
        ? "Your sheet has 30 photos. Remove one to add another."
        : "You have 90 photos to print. Lower a copy count to add a new photo.",
    );
    return;
  }
  setBusy(true);
  const maxPixels = pixelLimit(state.photos.length + selected.length);
  const photosToResize = state.photos.filter(
    (photo) => photo.naturalWidth * photo.naturalHeight > maxPixels,
  );
  const preparationTotal = photosToResize.length + selected.length;
  let completed = 0;
  updatePreparationProgress(completed, preparationTotal);
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
        completed++;
        updatePreparationProgress(completed, preparationTotal);
      }
    }
    for (const [index, file] of selected.entries()) {
      announce(`Getting photo ${index + 1} of ${selected.length} ready…`);
      try {
        const image = await preparePhoto(file, maxPixels);
        state.photos.push({
          id: createPhotoId(),
          copies: 1,
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
      } finally {
        completed++;
        updatePreparationProgress(completed, preparationTotal);
      }
    }
    const messages = [];
    if (added)
      messages.push(
        `${added} ${added === 1 ? "photo added" : "photos added"}. Need extras? Set Copies for teammates.`,
      );
    if (failed)
      messages.push(
        `${failed === 1 ? "One photo couldn’t" : `${failed} photos couldn’t`} be opened. Try a JPEG or PNG${tooLarge ? " or a smaller photo" : ""}.`,
      );
    if (files.length > available)
      messages.push(
        "You can choose up to 30 photos and print up to 90 copies in total. Lower a copy count or remove a photo to make room.",
      );
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
  $("editor-copy-status").textContent = "";
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
  $("editor-copy-count").textContent = String(copyCount(photo));
  $("copies-less").disabled = copyCount(photo) === 1;
  $("copies-more").disabled =
    copyCount(photo) === MAX_COPIES_PER_PHOTO ||
    totalCopies(state.photos) === MAX_PRINTED_PHOTOS;
  $("remove").textContent =
    copyCount(photo) > 1
      ? `⌫ Remove photo (${copyCount(photo)} copies)`
      : "⌫ Remove photo";
  $("zoom").value = String(photo.scale);
  $("zoom-value").value = `${Math.round(photo.scale * 100)}%`;
  $("zoom-out").disabled = photo.scale <= 1;
  $("zoom-in").disabled = photo.scale >= 4;
  // Keep the underlying print DOM current even when a browser print shortcut is used.
  for (const frame of $("pages").querySelectorAll(".photo-frame")) {
    if (frame.dataset.photoId === photo.id) applyCrop(frame, photo);
  }
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
$("photo-copies").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-delta]");
  if (button && !button.disabled)
    changeCopies(
      button.closest(".copy-row").dataset.sourceId,
      Number(button.dataset.delta),
      true,
    );
});
$("copies-less").addEventListener("click", () =>
  changeCopies(state.editingId, -1),
);
$("copies-more").addEventListener("click", () =>
  changeCopies(state.editingId, 1),
);
$("reset").addEventListener("click", () => {
  if (state.photos.length) $("reset-dialog").showModal();
});
$("cancel-reset").addEventListener("click", () => $("reset-dialog").close());
$("confirm-reset").addEventListener("click", () => {
  for (const photo of state.photos) releasePhoto(photo);
  state.photos = [];
  state.layout.photosPerPage = 9;
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

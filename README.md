# COMPASS Photo Printing — v1.02

A private, static photo-sheet maker for K–8 students using iPad Safari. Choose photos, pick **1, 2, 4, 6, or 9 per page**, tap a photo to adjust it, and print through the normal iPadOS/AirPrint interface. No accounts, uploads, database, runtime dependencies, or build step.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. Do not use `file://`: ES modules and service workers require an HTTP(S) origin. Offline installation works on HTTPS or localhost. For an iPad, use an HTTPS deployment; a trusted local network server can test most features, but plain LAN HTTP does not support the service worker.

## Deploy to Vercel

Production project: <https://ipad-printing.vercel.app>

The Vercel project is connected to `tatiang/ipad-printing`; pushes to `main` create production deployments automatically. The generated `ipad-printing.vercel.app` address is the official student-facing URL and does not include a personal name.

1. Import `tatiang/ipad-printing` into Vercel.
2. Choose **Other** for the framework, repository root for Root Directory, no Build Command, and `.` for Output Directory. No install command is needed.
3. Deploy and open the resulting HTTPS URL in Safari.
4. A Git-connected project can create preview deployments for pull requests once configured in Vercel.

No `vercel.json`, application environment variables, backend, database, or custom domain is needed. The app makes no third-party runtime requests, so `ipad-printing.vercel.app` is the only web origin students need for the app itself.

## Student workflow

1. The first screen shows **First, choose your photos** and one large green **Choose Photos** button. Tap it → Photo Library → select photos → Add. Layout and Print controls appear only after photos are chosen.
2. Under **Copies for teammates**, tap **+** or **−** beside each photo. The number is the total to print, including your own copy. For four teammates including you, set it to **4**. New photos start at one copy.
3. Choose **photos per page**. Nine per page remains the default; all five layouts are available. The preview immediately includes every copy and shows the resulting page count.
4. Tap a photo to rotate, zoom or crop. All copies of that photo share those edits. Copy controls also appear in the editor. **Earlier / Later** moves the photo and all its copies together; **Remove photo** removes the whole group.
5. Tap **Print**, select the AirPrint printer and US Letter portrait paper, and check the preview. Leave the native print dialog's job copies at **1**: the app already arranged the requested individual photo copies. Cut guides are no longer part of the app.
6. The same picker button becomes **Add More Photos** after import. **Clear all** asks before clearing the session and returns to the choose-photos-first screen. It never deletes originals from Photos.

Copy quantities range from 1–30 for each original, with at most 90 printed photos per job. Up to 30 original photos can be selected. At the combined limit, decrease a copy count to make room for another photo. To remove a photo entirely, use its editor's Remove action.

## Architecture and directory tree

```text
.
├── .agent/execplans/                  Implementation plans and verification records
├── .gitignore
├── CHANGELOG.md
├── RELEASE_SUMMARY.md
├── README.md
├── index.html                        Semantic interface and accessible native dialogs
├── style_v1.00.css                    Responsive UI, photo frames, Letter print rules
├── app_v1.00.js                       Session state, UI, pointer gestures and printing
├── geometry_v1.00.mjs                 Pure page/crop/order calculations
├── images_v1.00.js                    Sequential, bounded local image decoding
├── manifest.webmanifest              Home Screen app metadata
├── service-worker.js                 Allowlisted offline app-shell cache
├── icons/
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── tests/
    ├── geometry.test.mjs              Node geometry and ordering tests
    └── browser.mjs                    Chromium/WebKit functional and print checks
```

**HTML/CSS rather than page canvases:** the editor, preview, and print document use the same image and transform. Each sheet uses a single geometry definition in inches, projected into percentage positions for a responsive screen preview. Printing gives the exact same DOM a physical 8.5 × 11-inch size. This avoids large full-page raster buffers, preserves browser image rendering, and prevents separate preview/print crop implementations from drifting apart.

Each photo has a stable UUID, original in-memory `File`, working Blob URL, oriented dimensions, quarter-turn rotation, zoom (1–4×), normalized x/y travel offsets, and a copies count. Layout state is separate. Page generation expands references to each photo according to its quantity; copies share the same Blob URL and crop state, so increasing quantities does not decode or allocate additional working images. Removing/resetting releases each original URL once. Images cover their frames without stretching; crop bounds account for 90°/270° dimension swaps. Changing layout keeps edits bounded. Rotation recenters the crop for predictable student use. Crop edits are nondestructive; normalization does not crop the original file.

**Canvas is used only during sequential import**, to bake EXIF orientation into a bounded working JPEG. It is never used to rasterize whole pages. Each image is limited to a 2400-pixel long edge and initially 4 megapixels, with a 48-megapixel combined working-image budget divided across the requested count. When adding photos, existing images are re-prepared from their original files at the new budget, avoiding repeated lossy resampling. At typical small counts this provides about 200–300 DPI for an unzoomed full-page photograph and more in smaller cells. Large batches, unusual aspect ratios, low-resolution sources and deep zoom reduce effective DPI. Images are never enlarged during normalization. JPEG quality is 0.95; transparency is flattened onto white and animated inputs become stills. Removing photos does not increase the remaining working resolution until reimport.

A maximum of 30 photos, 40 MiB per source file, and 64 megapixels per decoded source protects against common excessive inputs. Decoding is sequential and canvas buffers are cleared immediately. The browser still needs to decode an individual source before its dimensions can be checked; extreme or malformed files and older iPads can exceed available memory. Try fewer or smaller photos if Safari reloads. Source files are compressed `File` references; they are not decoded in parallel or rendered in the document.

## Print CSS and fidelity

- `@page { size: letter portrait; margin: 0; }` defines a Letter page.
- Each `.sheet-wrapper` and `.sheet` is exactly **8.5in × 11in** in print.
- Frame positions reserve **0.25-inch outer margins** and **0.15-inch gaps**.
- Each wrapper forces a page break except the last. Empty slots have no DOM image, so they print white.
- Navigation, controls, dialogs, status, page labels and photo badges use print hiding rules. Only composed sheets print.
- A blocking, determinate progress card shows current/total preparation while files are decoded sequentially. Print remains disabled until all working preview images are decoded. The click calls `window.print()` synchronously, preserving the browser’s user gesture.
- Crops are percentage-based and use identical frame proportions in preview/editor/print, independent of viewport dimensions.

Browsers and printer settings ultimately control paper size, scaling, headers/footers, and image color. Select **US Letter, portrait, 100% / actual size** where available; turn off browser headers/footers. Do not select the printer’s multiple-pages-per-sheet feature. A printer requiring more than 0.25-inch margins can clip edges; verify the school printer before classroom rollout.

## Safari, iPad and AirPrint notes

- Safari 17 introduced HEIC/HEIF image support ([WebKit release notes](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)). Actual decoding depends on the OS, file variant and picker conversion. Unsupported HEIC in another browser shows a friendly error; use JPEG/PNG. No remote conversion service is used.
- The native `accept="image/*" multiple` picker offers Photo Library. No camera capture flag is imposed. The app does not control the library UI or whether iCloud downloads an original before returning it.
- Modern browser decoding handles EXIF orientation. Working JPEGs bake the displayed orientation once; test real portrait camera JPEG/HEIC files on the managed iPads.
- Pointer Events with pointer capture implement pan/pinch. `touch-action: none` applies only inside the editor crop frame. Browser zoom and normal scrolling elsewhere stay enabled. A pointer ending/cancelling resets the gesture baseline. Buttons and arrow keys are available without gestures.
- Native `<dialog>` provides focus trapping; Done/Escape closes it and restores focus. Photo buttons, layout selection, crop controls, and reordering are keyboard-accessible.
- CSS print sizing and transformed/clipped images need a physical Safari/AirPrint check. Desktop WebKit automation is useful but cannot certify the native iPadOS print sheet or a Xerox printer. [MDN printing guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing) describes the browser print hooks used here.
- The app calls the standard print interface only. It cannot discover/configure printers, choose native print-job copies, bypass printer selection, verify printed output, or guarantee a printer is reachable. The iPad and printer must have compatible network access and school AirPrint policies.
- Standalone Home Screen behavior varies by iPadOS/policy. If the Print button does not open the sheet in standalone mode, reopen the site in Safari and reselect photos. Session photos do not transfer between browser windows.
- Chrome and Edge are secondary targets; JPEG and PNG are the portable inputs. No browser-specific Xerox integration exists.

## Add to Home Screen / offline

On the deployed HTTPS site in Safari, use **Share → Add to Home Screen → Add**. Allow the first page to finish loading while online. The installed shell can launch offline afterward; photo selection and editing still happen locally. Printer network connectivity is separate from Internet access.

The service worker caches only an explicit list of bundled shell files. It does not intercept Blob URLs or cache imported photos, arbitrary requests, query strings, or third-party assets. New workers wait for existing sessions to close before activation, so updates do not reload an active sheet. When publishing future releases, bump the shell cache identifier and keep its file list in sync. Close all app windows and reopen to receive a waiting update; clear site data only if necessary (this clears a current session).

## Privacy and session lifetime

**Your photos stay on this iPad.** No analytics, external fonts, remote image APIs or network upload code. Photos exist as in-memory files and temporary Blob URLs only; there is no photo localStorage, IndexedDB, or Cache Storage entry. Remove and Start Over revoke working URLs. Temporary import URLs are revoked in `finally` blocks, including failures. Page exit/reload releases the session; back/forward cache may preserve it temporarily. Refreshing can clear all edits. No persistent draft is promised. Printing intentionally hands the composed document to the OS and the selected printer; printer retention policies are outside the app.

## Automated checks

No tools are required to serve the app beyond a static server. Node 20+ runs the dependency-free unit tests:

```sh
node --experimental-default-type=module --check app_v1.00.js
node --experimental-default-type=module --check images_v1.00.js
node --check service-worker.js
node --check geometry_v1.00.mjs
node --test tests/geometry.test.mjs
```

Browser tests use Playwright as an **optional development tool**, never a runtime dependency. Install it outside the repository if desired:

```sh
npm install --prefix /tmp/photo-sheet-qa --no-save playwright@1.63.0
/tmp/photo-sheet-qa/node_modules/.bin/playwright install chromium webkit
# Run the server in another terminal first.
PLAYWRIGHT_MODULE=/tmp/photo-sheet-qa/node_modules/playwright/index.mjs node tests/browser.mjs
```

The offline check stops an isolated test server, rather than relying on WebKit’s offline simulator (which returned an internal navigation error in this environment). The runner writes screenshots and PDFs to ignored `test-results/`. It covers all requested layouts and counts, rotation/crop, pan/pinch events, order/delete/reset, unsupported imports, per-photo/combined copy limits, shared crop edits, copy pagination, Letter dimensions and PDF pagination, hidden print controls, narrow/landscape viewports, URL cleanup and offline shell caching. Real iPad touch and actual printed output remain separate acceptance checks.

## iPad QA checklist (required before classroom rollout)

- [ ] Open the HTTPS site in current Safari on the school-managed iPad.
- [ ] Before import, only the large Choose Photos button is actionable; later layout and print controls are hidden. The button is visible without scrolling in both iPad orientations. Choose Photos opens the native picker; cancelling changes nothing; select multiple files.
- [ ] Import portrait camera JPEG and HEIC/HEIF; confirm correct EXIF orientation. Test a PNG and a rejected/broken file.
- [ ] Confirm 9-per-page is selected on a fresh sheet. Test 1, 2, 4, 6, and 9-per-page layouts.
- [ ] Import 14 photos, select 9: **2 pages**, last page has five photos. Import 10, select 4: **3 pages**, last page has two.
- [ ] Tap a photo; rotate 90°, 180°, 270°, then 360°. Pinch in/out, pan to every edge, lift one finger and keep dragging. No exposed blank frame space.
- [ ] Check zoom buttons/slider, four move buttons, Reset crop, Done, keyboard focus, Escape and VoiceOver labels.
- [ ] Move a middle photo earlier/later across a page boundary; remove a middle photo. The remaining order is correct.
- [ ] Check portrait and landscape iPad orientation, long pages and browser zoom; preview keeps Letter proportions.
- [ ] Choose two photos; set one to 4 copies and the other to 2. Select 4 per page: expect 6 printed photos on 2 pages. Crop/rotate one copy; every copy of that original updates. Decrease quantities, reorder and remove a photo; its entire copy group follows. Confirm there are no cut-guide controls or lines.
- [ ] Tap Print; native iPad print UI opens, AirPrint printer (including Xerox VersaLink C620) appears.
- [ ] Select Letter portrait. Print an edited multi-page sheet: one physical sheet per preview page, no controls/page labels, matching rotation/crop/spacing, and unclipped margins.
- [ ] Repeat with a Home Screen launch. Use the Safari fallback if standalone printing is unavailable.
- [ ] After initial online load, open the installed app offline; shell loads. Confirm no selected photos survive a fresh reload.
- [ ] Clear all → Keep my sheet preserves photos. Confirm clearing resets photos, crops and copy quantities and returns to 9-per-page. Remove the last photo and confirm the empty state.
- [ ] Try a typical 15-photo batch and a 30-photo batch on the oldest supported school iPad; verify memory stability and acceptable print detail.

## Known limitations / release status

v1.02 is portrait Letter only, with no cloud drafts or photo recovery after refresh. Very large files, unsupported codecs and excessive batches are rejected politely. Working-image normalization trades some source resolution for iPad memory safety. Browser/OS printing can override CSS preferences. Physical iPad/AirPrint QA is required before calling the deployment classroom-validated; software tests alone do not prove hardware acceptance.

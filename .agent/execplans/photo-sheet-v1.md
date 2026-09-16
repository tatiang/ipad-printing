# Photo Sheet v1.00

## Goal
Build a static, private, touch-first US Letter photo layout and AirPrint app.

## Acceptance and verification
- Import JPEG/PNG and browser-decodable HEIC locally; reject bad files gracefully.
- Exercise all five layouts, 14/9 and 10/4 pagination, rotations, bounded crop/zoom, order, deletion and reset.
- Use the same frame geometry for editor, preview and physical Letter print output.
- Verify no controls in print and exact PDF page count/dimensions with browser automation.
- Check responsive UI, keyboard dialog behavior, resource release and offline app shell.
- Run Node geometry tests, JS syntax checks and browser integration tests. Record hardware-only iPad/AirPrint checks honestly.

## Architecture decision
Use HTML/CSS frames and normalized nondestructive transforms, not full-page canvases. Fixed Letter geometry is expressed as proportional screen layout and physical print units. Sequential import creates bounded, EXIF-oriented working images (up to 2400 px long edge; 300 dpi across the 8-inch printable width where source permits). Original files remain local in memory for this session. This bounds decoded memory across 30 photos; no full-size page canvases. Use the identical working image and transform in editor, preview and print. No runtime dependencies or backend.

## Progress
- [x] Verify repository, fetch main and create feature branch.
- [x] Read requirements and define acceptance before coding.
- [x] Implement application, print styles, PWA shell and icons.
- [x] Write documentation and meaningful geometry/browser tests.
- [x] Run checks, inspect UI and PDF, fix defects.
- [x] Update changelog/release summary and prepare the verified release commit.
- Publication: commit, push and PR creation follow this snapshot; their immutable results are recorded in the task and PR.

## Decision log
- 2026-09-16: Use root static site, zero build process, vanilla ES modules.
- 2026-09-16: Use 0.25-inch outer margins and 0.15-inch gaps; default 4 per page.
- 2026-09-16: Limit selection to 30 images and decode sequentially to limit memory peaks. Cap working-image total pixel budget, with a clear message if exceeded.
- 2026-09-16: Native iPad printer selection and physical page fidelity require hardware QA; desktop automation cannot certify them.

## Surprises
- Workspace had an unrelated empty Git initialization with no remote; user authorized connecting it to the requested repository.
- Git checkout required a sandbox escalation; repository contains only a starter README.

## Verification record
- Node: 9/9 geometry, pagination, crop-bound and ordering tests pass.
- Syntax: app, image, geometry, service worker and browser test modules pass.
- Chromium 153 + WebKit 26.6: all requested layout/count cases, real EXIF tag, edits, ordering across a page boundary, deletion/reset, responsive layouts, 30-photo budget and Blob URL cleanup pass.
- Chromium: two-finger touch injection and exported Letter PDFs with exact page counts pass.
- Both engines: offline reload succeeds with the actual test server stopped; no third-party network requests occur.
- Visual inspection: empty, editor, populated sheet, narrow viewport and iPad-size screenshots reviewed.
- Hardware: native iPad Photos picker, HEIC variants, physical touch and AirPrint printer output remain explicit manual QA.

## Additional decisions and surprises
- WebKit offline simulation failed with an internal navigation error. A minimal reproduction showed online reload works; an actual stopped-server test passed. The committed suite uses the latter for both browsers.
- The native dialog close event is asynchronous. The focus assertion waits for restored focus instead of checking immediately after `open` becomes false.
- Optional Playwright 1.63.0 and agent-browser tools were installed outside the repository. The shipped app still has zero runtime dependencies.
- CHANGELOG uses HEAD for its containing change because a commit cannot embed its own immutable hash without changing that hash.

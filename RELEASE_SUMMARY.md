# COMPASS Photo Printing v1.02

Students start on a single-action screen: **First, choose your photos**, with a large Choose Photos button and Photo Library instructions. Layout and Print controls appear only after import. That same picker becomes Add More Photos afterward.

## Copies for teammates

Each original has visible minus/count/plus controls beside its thumbnail and inside the editor. Counts start at one and include the student's own copy. Copies stay adjacent, share edits, and are included in preview page counts and composed print output. Reordering moves the entire group; removing the original removes its copies. Limits are 30 copies per original and 90 printed photos per job, with the existing 30-original and 48 MP working-image budget unchanged.

Cut guides are removed from the UI, state, rendering and print styles. All five existing page layouts and the 9-up default remain available.

## Architecture and privacy

The static photo-printing application has no backend or runtime dependencies. Copies reuse each original's Blob URL and crop state rather than allocating more image buffers. Photos remain local in session memory. No auth, Firestore, secrets or calendar-app changes are included. The service worker cache identifier advances to v1.02; close existing app windows to let a waiting shell update activate.

## Verified

- 12 Node geometry, quantity-limit, grouping and ordering tests pass; JavaScript syntax and diff checks pass.
- Chromium 153 and WebKit 26.6 pass the complete photo workflow, first-screen visibility at iPad portrait/landscape and phone sizes, native file-picker invocation, per-photo and combined quantity limits, shared crop edits, reordering/removal/reset, resource cleanup and offline shell loading.
- Chromium PDF export confirms physical Letter dimensions and exact page counts with repeated photos. Both engines confirm print controls stay hidden and no cut guides remain.
- Increasing copy counts allocates no additional Blob URLs; deletion releases originals once. The existing 30-original/48 MP checks still pass.
- Screenshots of the first screen, editor and multiple-copy preview were visually reviewed. The WebKit copy-button focus issue found during testing was corrected.

## Hosting and remaining checks

Production remains https://ipad-printing.vercel.app, updated from main through the existing GitHub/Vercel integration after merge. The separate Coffee Time application is unchanged. Real iPad touch, Photos/HEIC variants and physical AirPrint output still require the README hardware checklist. Print one native job copy: the app already composes each requested individual photo copy.

# COMPASS Photo Printing v1.00

COMPASS Photo Printing turns an iPad photo selection into composed US Letter sheets, ready for the native AirPrint interface. This initial release includes three enabled layouts (4, 6 and 9 per page; 1 and 2 are disabled), local crop/zoom/rotation, accessible ordering and removal, optional cut guides, and an offline-capable app shell.

## Architecture and privacy

Static HTML/CSS and vanilla JavaScript; no runtime dependencies, build step, accounts, backend, Firestore, analytics or photo uploads. Preview and print share the same HTML image frames and crop transforms. Sequential image normalization bounds working-image resolution and memory. A new service worker caches an explicit app-shell allowlist only; selected photos remain in session memory and Blob URLs are released on removal/reset/page exit.

## Verified locally

- Nine Node geometry/order tests and JavaScript syntax/whitespace checks pass.
- Chromium 153 and Playwright WebKit 26.6 pass all five enabled layout/count cases, EXIF orientation, rotation/zoom/pan, accessible cross-page ordering, deletion, reset, narrow/landscape layouts, 30-photo limits, resource cleanup and no external requests.
- Chromium touch injection verifies two-finger pinch; desktop WebKit verifies the Safari engine’s functional and print-style behavior.
- Chromium PDF export has exact Letter dimensions and expected 1/2/3-page counts. Print styles hide all app controls and labels.
- Both engines reload the app shell after an isolated local server is stopped. WebKit’s simulated-offline mode returned an internal navigation error; the real stopped-server check passes.

## Remaining hardware/deployment checks

Native iPadOS Photos picker, real iPad touch/HEIC variants, Home Screen printing, printer discovery and physical Xerox/AirPrint output require the README checklist. No production deployment or hardware validation is claimed. Deploy as a static site using the README Vercel instructions; hosting is not provisioned by this commit.

## COMPASS interface update

Rename the app and Home Screen title to COMPASS Photo Printing, emphasize printing only what is needed for a journal, remove the requested decorative text and duplicate import buttons, and keep a single Choose Photos button for initial and additional selections. Bump the app-shell cache so existing installations can receive the updated UI after closing all app windows.

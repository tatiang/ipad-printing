# Student-first photo workflow

## Goal

Make the primary photo-to-print path understandable at a glance for eighth-grade students, show unmistakable progress while selected images are being prepared, and default every new sheet to nine photos per page.

## Acceptance and verification

- A fresh load and Start Over both select 9 photos per page.
- Importing photos opens a prominent blocking progress surface with a determinate progress bar and current/total photo count; it closes only after preparation finishes or fails.
- The main interface communicates Choose Photos, choose a page layout, adjust, and Print primarily through large controls, icons, selection state, and proximity rather than paragraphs.
- All 1-, 2-, 4-, 6-, and 9-up choices remain available and visually preview their grid.
- Existing crop, rotate, reorder, cut-guide, print, offline, accessibility, and memory-limit behavior remains intact.
- Node geometry tests, JavaScript syntax checks, browser integration tests, responsive screenshots, and print checks pass.

## Progress

- [x] Inspect repository state, existing workflow, tests, and release documentation.
- [x] Implement the visual workflow, progress indicator, and 9-up default.
- [x] Extend automated checks for the new default and busy-state UI.
- [x] Run checks and inspect generated iPad/mobile screenshots.
- [x] Update release notes and changelog; prepare the verified release commit.
- Publication: commit, push, and GitHub Actions navigation follow this snapshot; their immutable results are recorded in the task.

## Decision log

- 2026-09-16: Use a bright, workshop-inspired paper-and-ink visual system with oversized controls and minimal copy; retain the existing static, dependency-free architecture.
- 2026-09-16: Use a determinate overlay during sequential preparation so students cannot accidentally print or add more photos while processing is incomplete.
- 2026-09-16: Keep preparation sequential to preserve the existing iPad memory-safety strategy.

## Surprises

- The existing live status text does announce each image, but its small placement below the workspace makes it easy to miss visually.
- The geometry layer supports all five layouts, while the current UI disables 1-up and 2-up. The requested core workflow calls for all five, so this update restores those two choices.
- The shell's default Node 18 cannot syntax-check browser ES modules as documented. Verification uses the installed Node 22 runtime with `--experimental-default-type=module`, and the README now records that exact flag.
- Sandboxed Chromium cannot create its macOS rendezvous port. The full browser suite passes when launched with the approved browser permission.

## Verification record

- Node 22: four syntax checks, `git diff --check`, and all 9 geometry/order tests pass.
- Chromium 153 and Playwright WebKit 26.6: all five layouts, the 9-up default/reset, current/total preparation progress, print page counts, editing, responsive layouts, offline shell, and memory/resource limits pass.
- Browser screenshots reviewed at 1024×1366, 390×844, and 1366×1024; the empty, populated, editor, and preparation states remain legible without horizontal overflow.
- The local preview loads meaningful content with no framework error overlay; its full interactive control snapshot is present.
- Physical iPad Photos selection, native AirPrint, and the managed Lightspeed path remain hardware/network checks.

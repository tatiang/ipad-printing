# Faster photo preparation

## Acceptance
- Remove redundant decoding of the JPEG the app just created; keep source validation, orientation, JPEG quality, dimensions and memory limits unchanged.
- Loaded-image checks still gate printing and unavailable images remain blocked.
- Show app preparation duration to distinguish local processing from time in the native photo picker.
- Compare nine synthetic 12 MP photos before/after, then run existing Chromium/WebKit and Node checks.

## Progress
- [x] Inspect the image pipeline and measure a baseline.
- [x] Implement and verify the focused optimization.
- [ ] Update release notes and push to the existing unmerged print-fix PR.

## Decisions
- Keep decoding sequential to protect older iPads from simultaneous full-size camera buffers.
- Keep 4 MP/2400-pixel limits, JPEG quality .95, EXIF normalization, and 48 MP aggregate budget.
- Desktop timings do not predict iPhone/HEIC/iCloud times. Native-picker delay is outside app processing.

## Evidence
- Baseline: nine generated 4032x3024 JPEGs, Chromium 752 ms and WebKit 1145 ms; 18 explicit decodes each.
- After: Chromium 638 ms and WebKit 737 ms; nine explicit decodes each. These single-run desktop timings only establish reduced work, not the cause of the reported 30-second phone delay.
- Final validation: 12 Node tests and full Chromium/WebKit suites pass, including one source decode per imported photo, timing message, EXIF orientation, memory budget, print taps and offline shell.

## Follow-up: visible timing
- User could not see timing: completion text was below the full preview and shared with transient status announcements.
- Place last-import timing in a dedicated fixed Print-bar element; preserve it across crop/layout/copy changes, replace it on import, and clear it on reset.
- Acceptance: visible within 390x844 and 768x1024 viewports, persists through editing, clears on reset, and existing print workflow stays intact.
- Verification: initial mobile check exposed the existing hidden footer-information area; changed the phone footer to wrap and show it. Final full Chromium/WebKit suites, 12 Node tests, syntax and diff checks pass. Phone screenshot inspected; timing is present above Print and persists after editing.

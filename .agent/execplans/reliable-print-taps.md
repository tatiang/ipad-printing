# Reliable Print taps

## Acceptance
- Loaded preview photos enable Print even if optional image decoding rejects or stalls.
- Broken/loading images still prevent printing with visible status.
- Closing the crop editor preserves already-ready preview images.
- Touch taps call native print synchronously, including repeated use after edits.
- Run Node and Chromium/WebKit regression suites; retain Letter pagination and offline behavior.

## Progress
- [x] Confirm repository and inspect readiness and touch handling.
- [x] Reproduce decode rejection leaving Print disabled.
- [x] Replace decode gate with image load readiness and avoid editor-close rebuild.
- [x] Verify and document.
- [ ] Commit, push and open focused PR.

## Decisions
- Use load/error and naturalWidth for readiness; keep native print within the click event.
- Do not claim a physical iPad/AirPrint reproduction from browser automation.

## Surprises
- Every editor close previously rebuilt previews even though edits already update those frames live.

## Verification evidence
- Before fix: the loaded-image/decode-rejection test timed out with Print still disabled.
- After fix: that regression and editor-close identity/touch checks pass.
- Initial full run caught photo removal relying on editor-close rendering; moved rendering into the removal action before re-running.
- Final run: 12 Node tests and full Chromium 151/WebKit 26.5 suites pass, including rejected/stalled decode, broken-source blocking, repeat touch taps, PDF pagination and offline shell.

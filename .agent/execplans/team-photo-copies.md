# Copies for teammates and choose-photos-first workflow

## Goal
Make starting obvious, let students choose how many copies of each photo appear on the composed pages, and remove cut guides entirely.

## Acceptance before implementation
- Empty state has one large Choose Photos action and explicit Photo Library instructions; later controls are hidden until a photo is selected.
- Each selected photo has visible minus/count/plus copy controls, starting at one. The editor offers the same control.
- Copies are adjacent in reading order, share the source photo's crop/rotation, and affect page counts and physical print output.
- Copy counts are bounded: 1–30 per original, at most 90 printed photos total. The existing 30-original/48 MP memory budget remains independent of copy count.
- Removing an original removes its copies and releases its Blob URL once; changing quantities does not allocate or revoke images. Reordering moves the photo and its copies together.
- Cut-guide UI, state, rendering and CSS are removed. Current main's five layouts and 9-up default remain intact.
- Verify empty/mobile/iPad screens, native picker trigger, copy limits, mixed quantities, shared edits, cross-page ordering, removal/reset, print page counts, offline assets and regression tests in Chromium/WebKit.

## Progress
- [x] Inspect current main and preserve newer work, including the unrelated Coffee Time app.
- [x] Implement the focused workflow and copy quantities.
- [x] Extend and run meaningful copy/print/resource tests; inspect screenshots.
- [x] Finish outstanding read-only confidentiality audit; report any findings without changing auth or rewriting history.
- [x] Update release documentation and prepare a verified commit/PR.

## Decisions
- Use one state object per original photo with a copies count; expand references only for rendering. Every copy uses the same image URL and crop, with no extra image decoding.
- Keep only one photo-picker button. It dominates the empty state and becomes Add More Photos after import.
- Bump the visible release to v1.02 and the app-shell cache; retain versioned asset filenames for compatibility.
- Native iPad and physical AirPrint verification remains a hardware check.

## Surprises
- Main has evolved since the previous conversation, including restored 1/2-up layouts, 9-up defaults, progress UI, production hosting and an unrelated calendar app. This branch starts at current main.

## Verification record
- 12/12 Node tests pass, including group expansion, shared identity, quantity limits and reordering/removal.
- Chromium 153 and WebKit 26.6 pass the full browser suite: onboarding at 768×1024, 1024×768 and 390×844; native picker event; copies, shared edits, limits, accurate Letter print pages, resource cleanup and stopped-server offline reload.
- Visual inspection confirms one obvious initial action and legible teammate copy counters in the sidebar/editor.
- WebKit does not focus a clicked button the same way Chromium does. Copy changes now explicitly restore sidebar focus; both engines pass.
- Read-only public-content review covered 11 commits, 47 unique blobs and GitHub issue/PR/comment/release metadata. No embedded credentials were found. Public school calendar identifiers and commit identity were identified for the user's review; the separate calendar app and historical metadata were not changed.
- Release notes and changelog are updated. Commit/push/PR and preview results are recorded in the task after this snapshot.

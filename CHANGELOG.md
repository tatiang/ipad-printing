Sep 16, 2026 — 10:04 PM PT — HEAD — Connect production hosting for the photo printing app
- Publish the verified static app to Vercel and connect future `main` pushes to production deployments.
- Attach `photos.tatian.app` and document the remaining Cloudflare DNS approval.
- Keep local Vercel environment credentials out of Git.

Sep 16, 2026 — 9:30 PM PT — HEAD — Make photo printing visual and student-ready
- Show clear current/total progress while photos are prepared on the iPad.
- Default new sheets to 9-up, restore all five page layouts, and simplify the workflow into large visual actions.
- Refresh the offline app shell and document a Vercel-hosted `photos.tatian.app` option for school filtering.

Sep 16, 2026 — 2:50 PM PT — HEAD — Simplify COMPASS photo printing for journals
- Rename the app, emphasize printing only what students need, and remove the requested decorative text.
- Disable 1- and 2-per-page layouts and keep one Choose Photos button for all imports.
- Refresh the offline app-shell cache for the updated interface.

Sep 16, 2026 — 2:32 PM PT — 9c97450 — Add private photo sheets for iPad printing
- Choose up to 30 photos; arrange 1, 2, 4, 6 or 9 per Letter page; rotate, crop, reorder and print.
- Keep photos local, offer offline app-shell loading, and provide accessible touch and keyboard controls.
- Verify geometry, Chromium/WebKit workflows, EXIF orientation, memory limits and Letter PDF pagination; physical AirPrint QA remains required.

`HEAD` identifies this containing change. Its immutable commit hash is available with `git log -1 -- CHANGELOG.md`; embedding a commit’s own hash in its contents would change that hash.

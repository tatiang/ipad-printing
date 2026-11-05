# COMPASS Photo Printing v1.03

Adds **Save PDF → Download PDF** alongside native Print. Letter PDFs contain the current layouts, photo order, teammate copies, rotations, zoom and crop. A 150 dpi canvas is reused sequentially; JPEG bytes are embedded in a dependency-free PDF writer. All processing remains local, including offline export.

The explicit download tap avoids relying on popups or an asynchronous click to retain iPad browser activation. The user can save the PDF or print it from the PDF viewer. Editing the sheet invalidates the prior download link. The offline shell includes the new module and advances its cache version; close all app windows and reopen online to update.

Validation: 14 geometry/PDF tests pass, including binary offsets, page dimensions, copy pagination and crop drawing; JavaScript syntax and whitespace checks pass. Browser automation could not run because the browser executable was unavailable and its download returned an invalid archive. Native iPad download/share and physical AirPrint remain unverified.

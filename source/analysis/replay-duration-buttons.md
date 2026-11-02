# Replay button duration colours

Requested 2 November 2026: distinguish meaningful tries directly in the existing
clickable replay squares in Alle levels.

Completed attempts use the summary's active `dur`, which excludes app background
time. Under 60 seconds is muted red, 60-119 seconds green, and 120 seconds or more
a stronger green. The existing attempt number and result symbol remain. Hover and
accessible labels include the exact playing time and short/real attempt category.
Unfinished attempts and older records without a known duration remain neutral;
wall time and time since opening the level are not substituted for playing time.
No extra replay downloads, controls or table columns were added.

Validation: all six existing dashboard replay-viewer tests passed. Browser inspection
confirmed classification at 0, 30, 59, 60, 119, 120 and 210 seconds, plus missing
duration. Light, dark and 390px phone screenshots were inspected and are saved in
the ignored `analysis/archive/replay-duration-buttons/` directory.

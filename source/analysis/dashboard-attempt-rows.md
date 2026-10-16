# Dashboard attempt rows

Clickable attempts used the narrow default table column and wrapped one per line.
Render each attempt as one grid item, with five columns (four when the table container
is at most 320 px wide). Reserve space for the attempt column only in the levels table,
so the prediction table keeps its existing column widths. Keep the stars column on one line.
Replay buttons, attempt identifiers and selection behavior are unchanged.

Reserve 116 px for the Level column and prevent its labels from wrapping, including
daily puzzle dates. Checked level labels, stars and page overflow at viewport widths
1500, 900, 650, 390 and 320 px using the dashboard with a fake database.

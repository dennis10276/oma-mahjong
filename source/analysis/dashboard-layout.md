# Editing the dashboard layout

The **Indeling aanpassen** button opens a local visual editor. Each panel has a drag handle, up/down buttons, a width selector and a visibility checkbox. The lower corner adjusts width and minimum content height. Contents remain fully visible rather than being cropped. Hidden panels remain available in edit mode so they can be restored. Phones stack panels and use the width selector/move buttons instead of corner resizing.

Save persists the layout in this browser's localStorage (`omamj.dashboard.layout.v1`); it applies to every selected player in this browser. Cancel restores the saved arrangement, or the original if no custom arrangement exists. Reset clears preferences and restores the original DOM positions. No layout changes are written to Firebase, shared with other visitors or applied to the player's app.

The editor moves existing DOM elements instead of copying or recreating them. Player selectors, live data rendering, hearts and replay listeners keep their original element IDs. The charts re-render after width changes. ResizeObserver measures panel contents into a twelve-column masonry grid; dynamic content changes resize the occupied rows. A mutation observer allows the initially empty hearts/alerts panel to appear when new data arrives. Saved values are validated against known panels; newly introduced panels are added automatically. Editor CSS and JavaScript use normalized-content hashes in asset URLs.

Validation covers drag/drop, accessible move buttons, corner resizing, visibility, save/reload, cancel/reset, responsive layout, panel overlap, replay controls after movement, live updates, corrupt preferences and absence of database writes.

Publish dashboard-only changes from a clean, updated main with `python source/release.py --dashboard-only --deploy`. This runs the complete offline suite and copies dashboard source to the published directory without changing the game or APK version.

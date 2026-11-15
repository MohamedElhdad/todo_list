# ListX — Features

A tiny offline-first todo PWA. Vanilla HTML/CSS/JS, no framework, no build step, no dependencies.

**Live:** https://mohamedelhdad.github.io/todo_list/

---

## Features

### Tasks
- **Add** a task from the input field (`+` button, or press **Enter** — never reloads the page)
- **Whitespace-only input** keeps the add button disabled
- **Strike a task** with the checkbox (green check, red line through the text)
- **Edit a task** by **double-clicking / double-tapping** it → a modal opens with the current text, edit and confirm (green **Save**) or cancel (keeps the original text). The task **stays in its place** in the list
- **Delete** a task with the red trash button → an **UNDO** toast appears; tapping anywhere on the toast restores the task (with its position and its strike state)
- **Clear all** with a confirmation popup, also undoable
- **Copy** a task with a long press (custom highlight + "Copied!" toast, no native menu)
- **Counter** shows the number of *remaining* (unstruck) tasks

### Accent colour follows the load
The logo `X` and the counter share one accent colour, driven by how many tasks remain:

| Remaining tasks | Colour |
|---|---|
| 2 or fewer | green |
| 3 to 5 | orange |
| more than 5 | red |

### Appearance
- **Dark theme** (default) and **light theme** — toggle with the sun/moon button at the top right; the choice is remembered, and the status bar colour follows the theme
- **Typography**: Arabic in **Tajawal**, English in **Inter** — both self-hosted, so the app works fully offline and looks identical on every device
- Per-script weights: Arabic tasks render slightly heavier than English ones
- **Design system**: every button has a hover state, a press-down scale, and a visible keyboard focus ring; destructive actions are red, affirmative ones green, safe exits neutral
- **Modals** blur the page behind them and spring into place
- **Toasts** carry an icon (check for copied, undo arrow for delete) and slide up from the bottom

### PWA
- **Installable** on Android and desktop (manifest with proper icons and colours)
- **Works offline** — a service worker caches the whole app and serves it without a network
- **No text selection** by accident; long press is reserved for copying a task
- Updates land on the next app open or two — the service worker pulls fresh files from the network on install

---

## Keyboard

| Key | Action |
|---|---|
| **Enter** (in the input) | add the task |
| **Enter** (in the edit modal) | save the edit |
| **Escape** (in the edit modal) | cancel the edit |
| **Double-click** a task | edit it |
| **Space** (on the checkbox) | strike it |

## Gestures

| Gesture | Action |
|---|---|
| **Double-tap** a task | edit it |
| **Long press** a task | copy it |
| **Tap** the trash icon | delete it (undoable) |

---

*Built as an offline-first PWA. See `Agents.md` for the development playbook and the rules this project follows.*

# Agents.md — Working on ListX PWA

> Read this file before every change to the repo. Every rule here was learned the hard way in a real session — including a completely broken deploy and a broken regex that killed the whole app for a minute.

**Stack:** vanilla HTML/CSS/JS, no framework, no build step. Files: `index.html`, `css/style.css`, `js/app.js`, `sw.js`, `manifest.json`, `fonts/`, `imgs/`.

---

## 1. The golden rule: no console errors, ever

A single `SyntaxError` in `js/app.js` kills **the whole app** — add button, strike, copy, undo, clear, everything. One bad regex (`[\u0870-08FF]`, a malformed range) shipped to production and broke every control.

```
Before every commit:
□ git status --short            → no test screenshots (root *.png), no .playwright-mcp/
□ node --check js/app.js         → catches syntax errors before they ship
□ Open the page in a FRESH browser tab (see §11)
□ Exercise: add (Arabic + English), strike via checkbox, double-click → edit modal,
  edit + save, edit + cancel, theme toggle, Clear → modal, spaces-only input → add disabled,
  delete → UNDO toast
□ console errors → 0
□ Push
□ Verify live via HTTP with cache-bust (see §3)
```

## 2. `git push` ≠ the site is updated

GitHub Pages goes down repeatedly ("We're having a really bad day"), deployments lag, and `Cache-Control: max-age=600` means browsers keep serving old files for ~10 minutes. A commit can be live on `origin/main` and still invisible to the user.

**Always verify with HTTP + cache-bust, never trust the push output alone:**

```powershell
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
$h = @{ 'User-Agent' = $ua; 'Cache-Control' = 'no-cache' }
Invoke-WebRequest -Uri "https://mohamedelhdad.github.io/todo_list/sw.js?bust=$((New-Guid).ToString('N'))" -Headers $h -UseBasicParsing
```

**When the user says "it's still the same":** it is almost always stale HTTP/SW cache, not a bug in the new code. Ask them to open the app twice or three times, or clear site data in Chrome settings. Say this explicitly instead of re-debugging.

## 3. Service Worker rules (the PWA)

- **Every change gets a new `CACHE_NAME`** — never reuse a version (two different builds ended up under `v25`; the phone silently kept the old one).
- The SW `install` handler fetches assets with `cache: 'reload'` so a new cache always holds fresh files instead of a stale HTTP cache.
- `skipWaiting()` + `clients.claim()` are already wired in `install`/`activate` — do not remove them, they are what makes the update reach an already-open app.
- `activate` deletes every cache whose name !== `CACHE_NAME`. That is the only cleanup path.

**Clean-slate check in a test browser (required before trusting any UI verification):**

```js
navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())));
caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
```

Then reload **twice** (first load installs the SW, second load is served by it). See §11 — this is the single most common source of "my fix doesn't show up".

## 4. Fonts — current state, intentionally self-hosted

| Script | Family | Weights | File(s) |
|---|---|---|---|
| Arabic | **Tajawal** | 400 / 500 / 700 | `fonts/tajawal-{400,500,700}-arabic.woff2` |
| Latin | **Inter** (Variable) | 100–900 | `fonts/inter-var-latin.woff2` |

- Every `@font-face` declares its own `unicode-range`, so the Arabic file never covers Latin glyphs and vice versa.
- Per-element weight by **script detection**, not a shared class:

```js
// Built at RUNTIME and cached. A regex LITERAL containing \p{...} is parsed when
// the whole file is parsed, so on engines without Unicode property escapes the
// literal itself is a fatal SyntaxError — no try/catch inside the file can save it.
let arabicRe = null;
try { arabicRe = new RegExp('\\p{Script=Arabic}', 'u'); } catch (e) { arabicRe = null; }

const hasArabic = function (text) {
    if (arabicRe) return arabicRe.test(text);
    return /[\u0600-\u06FF\u0750-\u077F]/.test(text);   // the ONLY hand-written ranges allowed (valid, in order)
};
p.classList.toggle('ar', hasArabic(task));                // CSS: .task-content.ar { font-weight: 500; }
```

- **Never** hand-write hex ranges to detect a script. `[\u0870-08FF]` is invalid (`Range out of order`) and it took the entire app down. Use `\p{Script=...}` — but build it at **runtime** with `new RegExp(...)`, because a regex literal with `\p{...}` is a parse-time SyntaxError on old engines and no try/catch can catch it (see the snippet above).
- The native `text-decoration: line-through` sits slightly high on Android (font-metric driven) and **cannot be offset**: `text-underline-offset` affects `underline` only, never `line-through`. A self-drawn gradient strike was built and tested; the user preferred the native one. Don't re-attempt it unprompted.
- If the font stack changes, bump the SW cache and delete the old font files from `fonts/` **and** from `ASSETS` in `sw.js`.

## 5. CSS traps hit in this session

1. **Nested selectors break colour rules.** `header h1 { > span.logo-x { color: var(--accent) } }` compiled to `& > span.logo-x` and the colour never applied. Use **flat selectors** (`header h1 .logo-x`) for anything colour- or transition-critical.
2. **CSS variables do not animate through `transition`.** `color: var(--accent)` + `transition: color 350ms` did not animate — the value jumped only when the var was re-read. Use an **attribute/class on the root** (`html[data-accent="mid"]`) so the browser sees a real colour change and transitions it.
3. **Never use `word-break: break-all`** — it splits Arabic words mid-character. Use `overflow-wrap: break-word` (+ `word-break: normal`).
4. **`font-weight: 500` needs a matching face.** Tajawal ships 400/500/700 as separate files; asking for 500 with only 400+700 loaded gives the wrong result.
5. Keep the two weight systems separate: `.task-content`/input at 400 (Latin, light) and `.ar` at 500 (Arabic, heavier).
6. **Flex items default to `min-width: auto`** — a long unbroken word (300+ chars, a URL) makes the item's min-content width huge, so the item cannot shrink and the whole card overflows its container. `overflow-wrap: break-word` alone does nothing because the item never gets a constrained width. Any flex item that must wrap needs `min-width: 0` (`.task-content` has it — do not remove it).

## 6. Design system (v1) — the shared language

Every interactive control follows the same rules:

- **Hierarchy by colour:** green = affirmative (Save, armed add), red = destructive (Clear, Clear all, delete), neutral/translucent = safe exit (Cancel, Keep tasks).
- **Every button:** `:hover` (brighten), `:active` (`scale(.92–.96)`), `:focus-visible` (2px `--soft-green` outline, 2px offset).
- **Shadows are tight.** The first pass used `0 5px 16px` glows that looked blown out on the dark background; the user trimmed them manually to ~`0 4px 10px` and flattened the danger reds. Keep glows subtle — `0 2px 5px` for resting, `0 4px 10px` for hover.
- **Modals:** blurred backdrop (`backdrop-filter: blur(3px)`), 18px radius, spring entry (`240ms`, `cubic-bezier(.2,.9,.28,1.22)`), icon chip + title + one-line subtitle.
- **Toasts:** icon + message, 14px radius, 26px from the bottom, spring-free fade/slide, UNDO variant is a dark surface with a green action.

## 7. Accent colour follows the task count

The logo `X` and the counter share one accent, driven by remaining (unstruck) tasks:

| Remaining | `data-accent` | Colour |
|---|---|---|
| ≤ 2 | `low` | green `rgb(149, 218, 162)` |
| 3–4 | `mid` | orange `hsl(33, 100%, 50%)` |
| ≥ 5 | `high` | red `rgb(204, 65, 65)` |

> **Corrected 2026-11-15 (user-confirmed):** the code turns red at **5** remaining (`remaining > 4` in `updateAccentColor`) and that is the intended behaviour — 2 → green, 4 → orange, 5 → red. An earlier revision of this table said 3–5 orange / > 5 red: the table was the wrong side, not the code. Do not "fix" the code to match the old table.

Set from `updateAccentColor(remaining)` inside `localStorageUpdate()` — that function is the single place every mutation funnels through, so it is the right hook. The `data-accent` attribute lives on `<html>`.

## 8. Behaviours that must not regress

- **Double-click / double-tap a task → edit modal** (not strike). Strike is the checkbox only.
- **The edit modal edits in place** — the task keeps its position in the list, is not re-appended.
- **Enter in the main input adds the task** (keydown → `addBtn.click()`), never reloads the page. The form must never submit.
- **Spaces-only input** keeps the add button disabled (`trim()` check).
- **Delete keeps a trash buffer** (max 20) so UNDO restores position *and* strike state.
- **The counter** shows remaining (unstruck) tasks: `tasks.length - line.length`.
- **Long-press on a task copies it** (custom toast, no native menu); the checkbox and delete button stay excluded from the double-tap handler.
- **Very long unbroken text** (300+ chars with no spaces, or a long URL) must wrap INSIDE the task card — never overflow it, and the checkbox + delete button must stay visible. Backed by `min-width: 0` + `overflow-wrap: break-word` on `.task-content` (§5.6). Test on a 360px viewport in both themes.
- **Escape closes whichever modal is open** (edit modal first, then the clear-all popup) — one global idempotent `keydown` handler.

## 9. localStorage keys

`tasks` (array of strings), `line` (array of struck task texts), `trash` (undo buffer), `theme` (dark/light), `task-input` (sessionStorage, the in-progress input).

- The `line` array is keyed by **task text**, so renaming a struck task must rewrite that array too — `saveEditTask()` does it. Forgetting this makes the strike disappear on reload.
- `localStorageUpdate()` must tolerate a task element with no text node (an empty task once slipped in and killed the whole script). It now skips empty text instead of throwing (`p ? p.textContent.trim() : ''`).
- **Known limitation (deliberately deferred):** the `line` array is keyed by task TEXT, so two tasks with identical text corrupt strike/counter state — unstriking one removes both from `line`. The proper fix is stable task IDs; don't patch around it without a decision.

## 10. Tooling notes

- **Use `node` for surgical file edits.** PowerShell quoting inside `shell` commands mangles HTML/CSS with tabs and quotes (the `-replace`/string-literal traps cost several failed edits). Write a temp `.js` file, run it with `node`, delete it.
- **`browser.evaluate` runs in one shared page scope.** Declaring `const i = ...` in two evaluations throws `Identifier 'i' has already been declared`. Use `window._x` or unique names per call.
- **Synthetic key events:** `browser.press` may not deliver a `keydown` with `key: 'Enter'` the way the app expects. Dispatch it explicitly when a key path must be verified:
  `el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`.
- **The `browse` MCP server drives the user's real Chrome** through the browse extension (it is what the user installed). It gives access to their logged-in sessions and their actual ListX data — never create, edit or delete their real tasks during a verification pass; use a scratch tab and `localStorage.clear()` first.
- `browse execute` needs `--session <id>` **and** `--target-url <fragment>` together, otherwise it opens a blank tab or fails with "No existing attached page URL includes ...".

## 11. The verification protocol (learned the expensive way)

A verification that reuses a warm tab can silently test the **old** build — the SW cache, the HTTP cache, or a stale `index.html` all serve yesterday's code. Two of the "failures" in this session were the tool showing stale CSS, not broken code.

```
1. Close every tab of the session.
2. Open a NEW tab.
3. Run the SW unregister + cache delete snippet (§3).
4. Reload twice.
5. Only then trust what you see.
```

Cheap sanity check before any UI assertion:

```js
document.styleSheets[0].cssRules.length   // does the stylesheet even contain the new rule?
```

If the rule you just wrote is missing from the CSSOM, you are looking at a cached file — fix the cache, not the code.

## 12. Current environment notes

- Egyptian Arabic in chats, English in code and docs.
- The user is on a real Android phone (PWA installed) and a laptop; **Android Chromium renders differently from Windows Chromium** (strike position, font metrics, viewport behaviour). Never conclude "it works" from the laptop alone.
- The user's phone keeps the old build until the SW updates → always tell them to open the app twice after a deploy.
- `Agents.md` (this file) is the memory of the project — update it whenever a new rule is learned.

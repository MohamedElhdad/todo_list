# Agents.md — Working on ListX PWA

> Read this file before every change to the repo. Every rule here was learned the hard way in the last session — including a completely broken deploy.

## 1. The golden rule: no console errors, ever

A single `SyntaxError` in `js/app.js` kills **the whole app** — add button, strike, copy, undo, clear, everything.

```
Before every commit:
□ git status --short           → no test screenshots (root *.png, .playwright-mcp/)
□ Open the page in the test browser
□ Manually do: add (Arabic + English), strike both, toggle theme, Clear → modal, type-only-spaces → add disabled
□ console_messages → 0 errors
□ Push
□ Verify live via HTTP with cache-bust (see §4)
```

## 2. `git push` ≠ the site is updated

GitHub Pages can and does go down ("We're having a really bad day" happened repeatedly during this session). Deployment lag + CDN + `Cache-Control: max-age=600` means users may see old files for minutes after a push.

**Always verify with HTTP + cache-bust, never trust the push output alone:**

```powershell
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
$h = @{ 'User-Agent' = $ua; 'Cache-Control' = 'no-cache' }
Invoke-WebRequest -Uri "https://mohamedelhdad.github.io/todo_list/sw.js?bust=$((New-Guid).ToString('N'))" -Headers $h -UseBasicParsing
```

## 3. Service Worker rules (the PWA)

- **Every change gets a new `CACHE_NAME`** — never reuse versions (this happened; two different builds ended up under `v25`).
- The SW install fetches assets with `cache: 'reload'` so the new cache always holds fresh files, not a stale HTTP cache.
- A phone that installed an old SW will keep serving **the old JS** until the browser HTTP cache expires (up to ~10 minutes) or the user clears site data.
- The user will often say "still the same" after a fix commit — it is almost always stale HTTP/SW cache, not a bug in the new code. Ask them to open the app **twice or three times**, or clear site data in Chrome settings.

**Unregistering the SW in a test browser (required for a clean check):**

```js
navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())));
caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
```

## 4. Verify the live site, not the local repo

- `git log --oneline` tells you what was committed, not what the user gets.
- After every push, check **sw.js** and the asset you changed via the cache-bust fetch above.
- If the live site still shows the old version, the change has not reached users — even if the commit went through locally.

## 5. Fonts — the rules that matter

Current state, intentionally self-hosted:

| Script | Family | Weights | File(s) |
|---|---|---|---|
| Arabic | **Tajawal** | 400 / 500 / 700 | `fonts/tajawal-{400,500,700}-arabic.woff2` |
| Latin | **Inter** (Variable) | 100–900 | `fonts/inter-var-latin.woff2` |
| Icons | SVG (inline) | — | `index.html` |

- Every @font-face declares its `unicode-range` so the Arabic file never covers Latin glyphs and vice versa.
- Per-element weight via **script detection**, not a shared class:

```js
const hasArabic = (t) => /\p{Script=Arabic}/u.test(t);   // simple, reliable
// do NOT hand-write hex codepoint ranges — this caused a SyntaxError that killed the whole script
// and it broke the app for ~1 minute on the live site until the fix shipped
p.classList.toggle('ar', hasArabic(text));               // CSS: .task-content.ar { font-weight: 500; }
```

- `unicode-range` + `\p{Script=Arabic}` together: Arabic → Tajawal 500, English → Inter 400, same DOM node, mixed text just works.
- Vazirmatn was removed (Arabic line-through rendered too high in his device). Cairo/Tajawal tested better.

## 6. Line-through strike

- **Native `text-decoration: line-through`** is the current choice: perfect on Windows Chromium, slightly high on Android (unavoidable via CSS — `text-underline-offset` affects only `underline`, never `line-through`).
- A self-drawn gradient strike was built and tested, but the user chose the native one. Don't re-attempt it without a direct request.
- `word-break: break-all` was replaced by `overflow-wrap: break-word` — the old behavior split Arabic words mid-character across lines. Do not reintroduce it.

## 7. Checklist before every commit

```
□ git status --short          ← no verification screenshots, no .playwright-mcp/
□ Test in a browser (playwright)
  □ Add task (Arabic + English)
  □ Strike one of each via the checkbox
  □ Toggle theme (dark ↔ light)
  □ Open Clear → modal → No (Escape path)
  □ Type only spaces → Add button disabled
□ console_messages → 0 errors
□ Commit and push
□ HTTP check on sw.js + changed file(s) with cache-bust
□ Tell the user exactly what was verified and what was not (especially if checks were interrupted)
```

## 8. Hard-won lessons from this session

1. **"0 console errors" is the bar.** Not "should work", not "I pushed the fix" — the console must be silent.
2. **Cache names never repeat.** Same name → stale users get the old build silently.
3. **Push ≠ deploy.** GitHub Pages can fail, cache, or serve stale. Verify via HTTP.
4. **User-perceived staleness is usually HTTP/SW cache**, not a missing fix. Ask for two or three opens before "it's still broken".
5. **Don't repeat work the user already rejected.** If they pick font X over font Y, don't re-litigate it on the next task.
6. **`.gitignore` at root covers only `/*.png`** — manifest icons stay tracked, ad-hoc screenshots don't.
7. **Test in a real phone-HTTP-served flow**, not just a desktop browser — Android Chromium differs from Windows Chromium in rendering (e.g. native strike position).
8. **Never hand-write Unicode codepoint ranges** to detect a script. Use `\p{Script=...}` with the `u` flag.
9. **Verification runs before commit, not after.** If an error is found after commit, fix it and ship immediately rather than doing more work on a broken base.
10. **When you add a file, register it in `ASSETS` in `sw.js`** (or it won't be available offline).

## 9. Current environment notes

- Single repo, single page (no framework). `index.html` + `css/style.css` + `js/app.js` + `sw.js`.
- localStorage keys: `tasks`, `line`, `trash`, `theme`, `task-input` (sessionStorage for input).
- Icons live in `imgs/` (SVG inline in `index.html` for toggle + delete + checkbox).
- PWA installable via `manifest.json`. Egyptian Arabic audience; use Egyptian Arabic in chats, English in code.
- Live URL: `https://mohamedelhdad.github.io/todo_list/`

## 10. What to tell the user when reporting

- Be honest about what was verified and what was not (e.g. "GitHub Pages is currently serving stale content for me to verify around this").
- If you broke production at any point, say so plainly — they will value the truth over the cover story.
- If in doubt about the user's phone vs the desktop difference (which is most of the Android-strike pain), say it's a device-specific rendering issue and lead to the SW/unregister path — don't try to "fix" an Android-specific behavior with a generic workaround.

---

> **One sentence to live by:** Don't trust the code, trust the browser and a clean console — and the user's eyes.

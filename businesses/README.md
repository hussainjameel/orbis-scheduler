# Manual widget test fixtures

Two standalone HTML pages simulating different third-party business websites,
each with the real embed snippet the Share & Embed screen would generate for
a real business — for testing `widget.js` by hand in a browser.

**Not** meant to be opened as `file://` — that doesn't trigger real
cross-origin behavior (same-origin policy treats `file://` differently than
a real HTTP origin), which is exactly the thing this widget's correctness
depends on. Serve them as real HTTP instead:

```
npx serve businesses -p 4321
```

(Run from the repo root. `serve` needs no install — `npx` fetches it on
first run. Any static file server works identically; this is just the
least-fiddly option.)

## Full local test steps

1. Start the backend — from `backend/`: `npm run dev` (port 5000)
2. Start the frontend — from `frontend/`: `npm run dev` (port 3000)
3. Serve this folder — from the repo root: `npx serve businesses -p 4321`
4. Open in your browser:
   - **AF Architects**: http://localhost:4321/af-architects.html
   - **Willow & Vine Hair Studio**: http://localhost:4321/second-business.html

Both pages load `widget.js` from `http://localhost:3000`, so port 4321 vs.
3000 is what makes this a genuine cross-origin test, the same way a real
third-party site embedding the widget would be.

(`serve` redirects `/af-architects.html` → `/af-architects` by default —
harmless, just don't be surprised when the `.html` drops from the address bar.)

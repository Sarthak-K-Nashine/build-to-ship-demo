# Changelog

## 1.1.0

### Security
- **Stale login tokens could open another user's account.** Render's free disk resets on redeploy while `JWT_SECRET` stays the same, so a token issued before the reset matched whichever new user later got the same id. Tokens must now match a live account (id + email). Covered by unit tests.
- Content-Security-Policy turned on (only this origin plus Google Fonts; no inline scripts; no framing).
- Dependencies upgraded until `npm audit` reports 0 vulnerabilities: `bcrypt` replaced by `bcryptjs` (drops the vulnerable `tar` build chain and the native compile step), Express 4 to 5, Vite 5 to 7, React Router 6 to 7.

### Reliability
- Express 5 forwards errors thrown in async route handlers to the error middleware, so one bad request can't take the server down.
- Gemini calls retry once on 429/5xx. A 404 now hints that `GEMINI_MODEL` may not be available to the key.
- Unknown `/api/*` and `/v1/*` routes return JSON 404s instead of the HTML app.
- Negative `limit`/`offset` on `/api/events` are clamped.
- Graceful shutdown on SIGTERM (Render sends it on deploy).

### Detection
- Rule set rewritten: context wipes ("ignore everything above"), creator overrides, replacement instructions, context echo ("repeat the text above"), verbatim prompt requests, privilege escalation, unrestricted-AI and hypothetical no-limits personas, never-refuse and evil-twin personas, sentimental-roleplay ("grandma") exploits, safety-off claims, content-filter bypasses, leetspeak with `1` as `l`.
- Fewer false positives: bare mentions of "jailbreak" or "developer mode" are now weak signals, "a system prompt" in general questions no longer counts as extraction, and how-to questions or queries over data the user supplies no longer trigger bulk-exfiltration.
- PII: Aadhaar and phone numbers no longer match inside longer digit runs (e.g. the last 12 digits of a 16-digit number).
- Benchmark grew from 47 to 133 prompts. See the README for honest numbers.

### Developer experience
- No native add-ons left: SQLite now uses Node's built-in `node:sqlite` (Node 22.13+), so the same install works on Windows, macOS and Linux without a compiler.
- `npm run setup` (generates `.env` with a random secret, installs both apps) and `npm run dev` (both servers in one terminal, Ctrl+C stops both). Works on Windows, macOS and Linux.
- `GETTING_STARTED.md` for newcomers, `.nvmrc`, GitHub Actions CI, `npm run test:unit`.
- Pages other than the sandbox are lazy-loaded: initial JS dropped from 648 kB to 249 kB.
- The sandbox shows a readable error on 400/429 responses instead of crashing; sign-out also clears the stored email.

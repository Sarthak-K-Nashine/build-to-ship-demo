# Getting started with PromptShield

This takes about 5 minutes. You don't need an API key to try it.

## 1. Install Node.js

You need **Node 22.13 or newer** (the current LTS is fine). Check what you have:

```bash
node -v
```

If it's missing or older, install the LTS version from <https://nodejs.org>. Then close and reopen your terminal.

## 2. Unzip and set up

Unzip the folder, open a terminal **inside the `promptshield` folder** (the one with this file in it), then run:

```bash
npm run setup
```

This creates `backend/.env` with a random secret and installs everything. It works the same on Windows, macOS and Linux, and it's safe to run again.

## 3. Start it

```bash
npm run dev
```

Open **http://localhost:5173** and click **Use the demo account**. Press `Ctrl+C` in the terminal to stop.

## 4. Things to try

| Page | What to do |
|---|---|
| **Sandbox** | Click the preset chips (Prompt injection, PII redaction, ...) and run them. The left side is an unprotected model; the right side goes through the firewall. |
| **Audit log** | Click any row to see *why* it was blocked. Export as CSV or JSON. |
| **Dashboard** | Charts of what was blocked and redacted. |
| **Policy** | Change strictness or switch detectors off, then rerun a sandbox prompt to see the difference. |
| **Benchmark** | Runs 133 test prompts against your current policy and shows what got through. |
| **Integrate** | Generates an API key and shows how to point any OpenAI-compatible app at PromptShield. |

## 5. Optional: turn on the AI inspector

Without a key, PromptShield uses fast pattern rules and a *simulated* model (labelled as such in the UI). To use real Gemini:

1. Get a free key at <https://aistudio.google.com/apikey>
2. Open `backend/.env` and set `GEMINI_API_KEY=your-key`
3. Stop (`Ctrl+C`) and run `npm run dev` again

Ambiguous prompts now get a second opinion from Gemini, and the sandbox talks to a real model.

## Where things live

```
backend/src/
  pipeline/detectors.js   pattern rules + PII detection   <- start here to add a rule
  pipeline/inspector.js   Gemini classifier (hardened)
  pipeline/outputGuard.js checks the model's reply
  pipeline/index.js       the pipeline that ties it together
  benchmark.js            the 133 test prompts
  routes.js, auth.js      the API
frontend/src/pages/       one file per page in the UI
```

## Tests

```bash
npm run test:unit    # no server needed: PII, rules, auth, benchmark floors
npm test             # end-to-end; needs `npm run dev` (or `npm start`) running in another terminal
```

If you change a rule in `detectors.js`, run `npm run test:unit`. It fails if detection drops below 95% or if any normal prompt gets blocked.

## Common problems

| Problem | Fix |
|---|---|
| `npm: command not found` | Node isn't installed or the terminal was opened before installing. Reopen it. |
| `Node ... is too old` | Install Node 22 LTS from nodejs.org. |
| `Dependencies are missing` | Run `npm run setup` first. |
| `EADDRINUSE :8080` or `:5173` | Something else is using that port. Close the other app, or set `PORT=8081` in `backend/.env` and start the frontend with `VITE_PROXY=http://localhost:8081`. |
| Login says "Cannot reach the server" | The backend isn't running. Check the `[api]` lines in the terminal for an error. |
| `Gemini HTTP 404` | Your key can't use the model in `GEMINI_MODEL`. Pick one listed in Google AI Studio. |
| `Gemini HTTP 429` | Free-tier rate limit. Wait a minute. With policy "fail closed", ambiguous prompts are blocked until Gemini answers again. |

Deploying is covered in `README.md` under **Deploy**.

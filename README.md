# Business Model Builder, browser dashboard (OpenRouter)

A dashboard that runs entirely in the browser. Enter a business, and it runs the full
research pass through the OpenRouter API and shows a client-ready visual report in the
same page, with downloads.

No server and no Render. It is a static site, so it hosts free on GitHub Pages. The
AI calls go straight from your browser to OpenRouter (OpenRouter allows browser calls;
Anthropic and Google do not, which is why we route through OpenRouter).

## What it produces
- A single-page visual report (`05-Visual-Report` style), rendered in the page
- A BMC canvas diagram and an Empathy Map diagram
- Downloads: HTML report, PDF (print), Word (.doc), Markdown, and the two diagrams

## Files
- `index.html`, the dashboard
- `style.css`
- `pipeline.js`, the 7-stage flow calling OpenRouter (research, empathy, competitor, BMC, growth, QA, designer)
- `app.js`, UI logic (key storage, progress, downloads)
- `visual-report-template.html`, the proven report design the output matches

## Your API key is safe
You paste your OpenRouter key into the dashboard. It is stored only in your browser
(localStorage) and is never put in the repository or uploaded anywhere. If you make
the site public, each visitor enters their own key.

## Deploy on GitHub Pages (free, no Render)
1. Create an OpenRouter account and key at https://openrouter.ai/keys
2. Put these files in a GitHub repository (upload all files at the repo root).
3. Repo, Settings, Pages, Source: "Deploy from a branch", Branch: `main`, folder `/root`, Save.
4. Wait 1 to 2 minutes. Your dashboard is live at `https://<username>.github.io/<repo>/`.
5. Open it, click Settings, paste your OpenRouter key, pick a model, then run.

## Run locally
Because the app fetches `visual-report-template.html`, open it through a small local
server (not by double-clicking the file):
```
cd business-model-builder-openrouter
python3 -m http.server 8000
```
Then open http://localhost:8000

## Model notes
- Best quality: `anthropic/claude-3.5-sonnet` or `openai/gpt-4o-mini` (paid, cheap).
- Free models (for example `meta-llama/llama-3.3-70b-instruct:free`) work but are
  rate-limited and weaker at the final HTML design step.
- "Use live web search (:online)" adds OpenRouter web search to the research stages
  for current data. Turn it off to save cost if you do not need fresh research.

## Cost and time
A full run makes about 8 model calls and takes roughly 15 to 30 minutes. Keep the tab
open. Watch usage in your OpenRouter dashboard.

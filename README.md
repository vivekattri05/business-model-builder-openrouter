# Business Model Builder (browser dashboard)

A single-page web app that turns one input, a website link, business name, niche, or
idea, into a complete, client-ready strategy pack. It runs entirely in your browser
and calls the OpenRouter API directly. There is no backend server, so it hosts free
on GitHub Pages.

Live app pattern: `https://<your-username>.github.io/<repo-name>/`

---

## 1. What it produces (every run)

- A single-page visual report (`05-Visual-Report` style): gradient header, sticky
  navigation, and six numbered sections (Executive Summary, Business Model Canvas,
  Empathy Map, Competitor Analysis, Kano Model Matrix, 40-Day Growth Plan), with a
  colour-coded Kano table and a growth-plan timeline.
- A Business Model Canvas diagram (poster style, filled with the business content).
- An Empathy Map diagram (poster style).
- Downloads: HTML report, PDF (via print), Word (.doc), Markdown, and the two diagrams.
- A per-run usage panel: time taken, cost, tokens (input, output, total), and AI calls.
- A project library: every finished run is kept in full, in this browser, including the
  actual report and diagrams, not just its stats. Refreshing or closing the tab does
  not lose it. Each entry has a View button (reopens it in the results viewer, with its
  own downloads) and a Delete button, plus averages across everything you have run
  (projects run, average time, average cost, total spent).

All output is white-label: no AI or tool mentions, and no em dashes, so it reads as
your own work. You choose English or Hinglish, and an optional byline (your agency or
consultant name) that appears on the report.

---

## 2. How it works (architecture)

- Pure front end: HTML, CSS, and vanilla JavaScript. No build step, no server.
- The browser calls `https://openrouter.ai/api/v1/chat/completions` directly.
  OpenRouter allows browser (CORS) calls; Anthropic and Google do not, which is why
  the app routes through OpenRouter.
- Your OpenRouter API key is entered in the dashboard and stored only in your
  browser (localStorage), saved as you type it, not only when you click Save. It is
  never committed to the repo or uploaded anywhere.
- A full run makes about 9 model calls and takes roughly 15 to 30 minutes. Keep the
  tab open while it runs; the work happens in the tab.
- Every finished step is checkpointed to localStorage. If a call fails or the tab is
  reloaded, running the same business, language, byline, and model again resumes from
  the last completed step instead of paying for the whole run twice.
- Every finished run is written to an IndexedDB library in this browser: the full
  report, both diagrams, and the markdown pack, alongside its stats. localStorage
  alone would not hold this (it caps out around 5 to 10MB, and a single report can run
  past 100KB); IndexedDB has far more room, and nothing is capped or auto-deleted.
- Every content-generating prompt carries a niche lock: it must name the business's
  real, specific category up front and ground every fact, mechanism, and competitor in
  it. This exists because the single most common failure in this kind of pipeline is a
  model quietly defaulting to the most familiar shape in its training data (an SEO or
  digital-marketing content business, complete with Google algorithm updates, GA4,
  Ahrefs/Moz, and "client" framing) for a business that has nothing to do with SEO. The
  quality reviewer stage also runs an explicit pass hunting for and fixing exactly this
  kind of industry drift.
- Failed calls are retried up to four times with exponential backoff, and each call is
  abandoned after five minutes rather than hanging forever.
- The report preview renders in a sandboxed iframe with no same-origin access, so the
  generated HTML cannot reach the page's localStorage where the API key is stored.

### The seven agents (in `pipeline.js`)

Seven agent prompts, shown in the dashboard as six progress stages: the empathy map
and the competitor research run at the same time, so they share stage 2.
1. Research: business, market (Wealth / Health / Relationships), niche and buyer
   floor, demographics and psychographics, Big Domino problem, real-life situations,
   and a starting competitor list. Uses live web search.
2. Empathy Map: Think & Feel, See, Hear, Say & Do, Pain, Gain, plus a niche
   archetype, in the customer's real words. Uses live web search.
3. Competitor and Kano: 10 or more real competitors, each classified into
   Must-Haves, Performance Benefits, and Delighters, plus an SEO audit, a gap
   analysis, and a full Kano matrix. Uses live web search.
4. Business Model Canvas: all nine blocks, including a named Unique Mechanism, a
   named conditional Guarantee, MVP milestones, market message plus two variations,
   channels, anchor pricing, and delivery.
5. 40-Day Growth Plan: situation read, the big decision (what to build first), four
   ten-day sprints (Foundation, Proof & Content, Traffic On, Convert & Scale), quick
   wins, and what to measure.
6. Quality review: a sign-off pass that checks the whole pack for consistency,
   completeness, and style, and returns one corrected, client-ready markdown pack.
7. Visual designer: builds the single-page visual report (matching
   `visual-report-template.html` exactly) plus the BMC and Empathy Map diagrams.

The methodology encoded throughout is the UAbility / HSIM model: Big Domino problem,
Kano UVP (Must-Haves, Performance, Delighters), a named Unique Mechanism, a named
Guarantee, the Island 1 to Island 2 MVP with milestones, the market-message template,
channels, anchor pricing, and delivery.

---

## 3. Files in this repo

- `index.html`, the dashboard page (settings, form, progress, results, history).
- `style.css`, the dashboard styling (dark theme, stat cards, timeline, tables).
- `pipeline.js`, the whole pipeline: OpenRouter calls, the seven agent prompts, the
  usage tally, and assembly of the reports and diagrams.
- `app.js`, the UI logic: saving the key and model to localStorage, the live timer,
  the run flow, rendering the usage panel, the per-project history, and all downloads.
- `visual-report-template.html`, the proven single-page report design the output
  copies exactly (only the content changes each run).
- `README.md`, this document.
- `DEPLOY-GitHub-Pages-Hinglish.md`, a short deploy guide in Hinglish.
- `LICENSE`, MIT.
- `.gitignore`, keeps `.DS_Store`, `.env`, and key files out of the repo.

---

## 4. Settings (in the dashboard)

- OpenRouter API key: get one at https://openrouter.ai/keys. Stored only in your
  browser.
- Model: nothing is preselected. Pick from the list or type a custom model id, and
  your choice is saved as your default from then on. What is in the list:
  - `anthropic/claude-sonnet-5`, strong writing and reliable on the big HTML design
    step, at a sensible price.
  - `anthropic/claude-opus-5`, best quality, and the most expensive.
  - `openai/gpt-5.6-sol`, the strongest OpenAI tier.
  - `openai/gpt-5.6-terra`, mid price.
  - `openai/gpt-5.6-luna`, the cheapest OpenAI tier.
  - `google/gemini-3.5-flash`, fast and cheap.
  - `google/gemini-3.5-flash-lite`, the cheapest paid option.
  - `nvidia/nemotron-3-ultra-550b-a55b:free`, free but rate-limited and weaker at the
    final HTML design step.

  Any model id from https://openrouter.ai/models works in the custom box. If you have
  an older version of this app saved in your browser, a retired model id is migrated
  to its current equivalent automatically.
- Use live web search (:online): adds OpenRouter web search to the research stages
  for current data. Turn it off to save cost if you do not need fresh research.
- Extra info you already know (optional, in the form, not Settings): anything you
  already know about the business, location, size, real competitors, whatever is
  relevant, given to every stage as ground truth. Especially useful for a small,
  niche, or lesser-known business that the web does not have much written about, where
  a model is otherwise most likely to fall back on a generic, wrong industry template.

---

## 5. How to use

1. Open the app.
2. Open Settings, paste your OpenRouter key, pick a model, and save.
3. Enter a business (link, name, niche, or idea), choose English or Hinglish, and an
   optional byline.
4. Click Run deep research and keep the tab open.
5. When it finishes, view the report in the page, check the usage panel, and use the
   download buttons.

---

## 6. Cost, tokens, and usage tracking

Each model call asks OpenRouter to return token counts and cost (`usage: {include:
true}`). The app adds these up for the run and shows: time taken, cost, input tokens,
output tokens, total tokens, and the number of AI calls. Every finished run is also
saved to the project library (see section 1) with its full report, so "Your projects"
below the form is both a spend record and a way back into any past pack.

You can also see the same data in your OpenRouter account:
- Activity, every call with tokens and cost: https://openrouter.ai/activity
- Credits and balance: https://openrouter.ai/credits

Cost depends on the model you pick in Settings; nothing is preselected. The Opus and
Sol tiers cost the most, Gemini Flash and the Luna tier are cheap, and free models cost
nothing but are rate-limited.

---

## 7. Deploy on GitHub Pages (free)

1. Create an OpenRouter key at https://openrouter.ai/keys
2. Put all files in a GitHub repository (at the repo root).
3. Repo, Settings, Pages, Source "Deploy from a branch", Branch `main`, folder
   `/root`, Save.
4. After 1 to 2 minutes the app is live at
   `https://<your-username>.github.io/<repo-name>/`.

### Run locally
Because the app fetches `visual-report-template.html`, use a small local server (do
not just double-click the file):
```
python3 -m http.server 8000
```
Then open http://localhost:8000

---

## 8. Update the live site (git)

After changing any file:
```
git add .
git commit -m "your message"
git push
```
GitHub Pages rebuilds in 1 to 2 minutes.

---

## 9. Privacy and safety

The OpenRouter key lives only in your browser and is never stored in the repo. If you
share the site publicly, each visitor enters their own key. Research runs make calls
to OpenRouter (and to the web search provider when :online is on).

Two things guard the key, because the research stages read live web pages and anything
found there is untrusted:

- The report preview iframe is sandboxed without `allow-same-origin`, so scripts in the
  generated HTML run in an opaque origin and cannot read this page's localStorage.
- The research prompts state that scraped pages are source material, never instructions,
  so text on a competitor's page cannot redirect the run.

The generated reports are also told to stay fully self-contained, with no external
scripts, fonts, images, or network calls, so a downloaded report phones nobody.

---

## 10. Troubleshooting

- 401 Unauthorized: the OpenRouter key is missing or wrong. Re-enter it in Settings.
- 402 Payment required: add credit to your OpenRouter account for that model.
- 429 Too many requests: rate limit hit (common on free models). Wait a minute and
  run again, or switch to a paid model.
- 404 on the model: that model id does not exist on OpenRouter. Check it against
  https://openrouter.ai/models
- PDF button does nothing: allow popups for the site, then click again.
- The run stops if you close the tab. Keep it open. Whatever finished is saved, and a
  banner above the Run button offers to carry on when you run the same business again.
- A run failed halfway and you want a clean start: use "Discard saved progress" in
  that banner.
- Weak or broken visual layout: use a stronger model (Claude or GPT) for the design
  step; free models sometimes struggle with the full HTML template.

---

## 11. Customization

- Report design: edit `visual-report-template.html`. The output copies its style.
- Models: edit the options in `index.html`. To preselect one for everybody, set
  `DEFAULT_MODEL` in `app.js` to that id; leave it empty for no preselection.
- Prompts and methodology: edit the `P` object and `METHOD` text in `pipeline.js`.
- Timeouts and retries: `CALL_TIMEOUT_MS`, `MAX_ATTEMPTS`, and `MAX_CONTINUES` at the
  top of `pipeline.js`.
- Dashboard colours: the `:root` variables at the top of `style.css`.

---

## 12. Limitations

- Runs in a single browser tab; long runs need the tab to stay open. Closing it does
  not lose finished steps, but the remaining ones stop until you run again.
- Quality tracks the chosen model. For client work, use a strong paid model.
- Free-tier models on OpenRouter are rate-limited and can fail mid-run.
- The Word download is HTML saved as `.doc`; it opens cleanly in Word and Google
  Docs but is not a native `.docx`.
- The project library lives in this browser's IndexedDB (settings and checkpoints stay
  in localStorage). Neither syncs between devices or browsers, and clearing site data
  removes both, so there is no cloud backup. This is the tradeoff for staying a static
  site with no server and no account to sign into; if cross-device access ever matters
  more than that, it would need a real backend.
- Cost is what OpenRouter reports per call. Web search (`:online`) is billed by
  OpenRouter as part of the call, so the totals include it.

---

## 13. License

MIT. See `LICENSE`.

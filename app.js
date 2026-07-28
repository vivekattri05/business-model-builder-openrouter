/* Dashboard UI glue. Talks to window.BMB (pipeline.js). */
(function () {
  const $ = (id) => document.getElementById(id);
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // ---- storage: IndexedDB holds every finished project in full (report,
  // diagrams, markdown pack), not just its stats. localStorage tops out around
  // 5 to 10MB and one report can run past 100KB, so the settings above stay in
  // localStorage but the project library lives here, with no cap: the point is
  // keeping every generation on record, not just the last few. ----
  const DB_NAME = "bmb_projects", DB_VERSION = 1, STORE = "projects";
  let dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB is not available in this browser"));
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { return reject(e); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  function idbPut(record) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }
  function idbAll() {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }
  function idbDelete(id) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }
  function idbClear() {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }
  // One-time move from the old stats-only localStorage list (from an earlier
  // version of this app), so anyone who already has entries there still sees
  // them listed. Those runs never had their content saved, so they show up
  // marked "archived" instead of offering a broken View button.
  async function migrateOldHistory() {
    const raw = LS.get("bmb_history", "");
    if (!raw) return;
    try {
      const old = JSON.parse(raw) || [];
      const existing = await idbAll();
      if (old.length && !existing.length) {
        for (const x of old) {
          await idbPut({
            id: Date.now() + "-" + Math.random().toString(36).slice(2),
            name: x.name || "", model: x.model || "", language: "", brand: "",
            date: x.date || new Date().toISOString(), seconds: x.seconds || 0,
            usage: { prompt: x.prompt || 0, completion: x.completion || 0, cost: x.cost || 0, calls: 0 },
            reportHTML: "", bmcHTML: "", emcHTML: "", pack: "",
          });
        }
      }
    } catch (e) { /* nothing usable to migrate */ }
    localStorage.removeItem("bmb_history");
  }

  // No model is chosen for the user. The empty value selects the "Choose a model"
  // placeholder, and whatever they pick is saved and becomes their own default.
  const DEFAULT_MODEL = "";
  // Models retired since an earlier version of this app. Anyone with one of these
  // saved gets moved to the nearest current equivalent instead of an empty box.
  const RETIRED = {
    "anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-5",
    "openai/gpt-4o-mini": "openai/gpt-5.6-luna",
    "google/gemini-2.0-flash-001": "google/gemini-3.5-flash",
    "meta-llama/llama-3.3-70b-instruct:free": "nvidia/nemotron-3-ultra-550b-a55b:free",
  };

  // ---- settings load ----
  $("apiKey").value = LS.get("bmb_apiKey", "");
  let savedModel = LS.get("bmb_model", DEFAULT_MODEL);
  if (RETIRED[savedModel]) savedModel = RETIRED[savedModel];
  $("model").value = savedModel;
  if (![].some.call($("model").options, (o) => o.value === $("model").value)) {
    // an unknown id is treated as a custom model, and kept rather than dropped
    if (savedModel && savedModel !== "__custom__") LS.set("bmb_custom", savedModel);
    $("model").value = "__custom__";
  }
  if (!$("customModel").value) $("customModel").value = LS.get("bmb_custom", "");
  $("online").checked = LS.get("bmb_online", "1") === "1";
  toggleCustom();

  function toggleCustom() {
    $("customModel").closest(".field").style.display = $("model").value === "__custom__" ? "block" : "none";
  }
  $("model").addEventListener("change", toggleCustom);

  function saveSettings() {
    LS.set("bmb_apiKey", $("apiKey").value.trim());
    LS.set("bmb_model", $("model").value);
    LS.set("bmb_custom", $("customModel").value.trim());
    LS.set("bmb_online", $("online").checked ? "1" : "0");
  }
  $("saveSettings").addEventListener("click", () => { saveSettings(); flash($("saveSettings"), "Saved"); });
  // Auto-save as soon as anything changes, so the key (or model, or the web
  // search toggle) is never lost to a refresh just because "Save settings"
  // was never clicked. The button still gives an explicit "Saved" confirmation.
  $("apiKey").addEventListener("input", saveSettings);
  $("model").addEventListener("change", saveSettings);
  $("customModel").addEventListener("input", saveSettings);
  $("online").addEventListener("change", saveSettings);
  $("settingsToggle").addEventListener("click", () => {
    const s = $("settings"); s.style.display = s.style.display === "none" ? "block" : "none";
  });
  function flash(btn, txt) { const o = btn.textContent; btn.textContent = txt; setTimeout(() => (btn.textContent = o), 1200); }
  function modelId() { return $("model").value === "__custom__" ? $("customModel").value.trim() : $("model").value; }

  // ---- formatting helpers ----
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }
  function fmtCost(c) {
    if (!c || c <= 0) return "Free / $0";
    if (c < 0.01) return "$" + c.toFixed(4);
    return "$" + c.toFixed(3);
  }
  function fmtNum(n) { return (n || 0).toLocaleString(); }

  // ---- stages + live timer ----
  let timerInt = null, startMs = 0;
  function startTimer() {
    startMs = Date.now();
    $("elapsed").textContent = "Elapsed: 0:00";
    timerInt = setInterval(() => { $("elapsed").textContent = "Elapsed: " + fmtTime((Date.now() - startMs) / 1000); }, 1000);
  }
  function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } return (Date.now() - startMs) / 1000; }

  function renderStages(cur, allDone) {
    const ul = $("stages"); ul.innerHTML = "";
    window.BMB.STAGES.forEach((label, i) => {
      const li = document.createElement("li");
      let state = "pending";
      if (allDone || i < cur) state = "done"; else if (i === cur) state = "active";
      li.className = "stage " + state;
      li.innerHTML = '<span class="dot"></span><span>' + label + "</span>";
      ul.appendChild(li);
    });
  }

  let RESULT = null;
  let RUN_NAME = "";

  // ---- resume banner for an unfinished run ----
  const TOTAL_STEPS = 9; // research, empathy, competitor, bmc, growth, pack, report, bmc diagram, emc diagram
  function renderResume() {
    const box = $("resume");
    const c = window.BMB.peekCkpt();
    const steps = c && c.done ? Object.keys(c.done).length : 0;
    if (!steps) { box.style.display = "none"; box.innerHTML = ""; return; }
    const when = c.at ? new Date(c.at).toLocaleString() : "";
    box.style.display = "block";
    box.innerHTML =
      "<div><strong>Unfinished run saved.</strong> " + esc(c.label || "") + " stopped after " +
      steps + " of " + TOTAL_STEPS + " steps" + (when ? " on " + esc(when) : "") +
      ". Run the same business, language, byline, and model again to carry on from there without paying for those steps twice.</div>" +
      '<button class="ghost-btn" id="discardCkpt" type="button">Discard saved progress</button>';
    $("discardCkpt").onclick = () => {
      if (confirm("Discard the saved progress? The next run will start from scratch.")) {
        window.BMB.clearCkpt();
        renderResume();
      }
    };
  }

  // ---- run ----
  $("runBtn").addEventListener("click", async () => {
    const apiKey = $("apiKey").value.trim();
    const business = $("business").value.trim();
    const model = modelId();
    const err = $("formError"); err.style.display = "none";
    if (!apiKey) return showErr(err, "Please enter your OpenRouter API key in Settings.");
    if (!model) return showErr(err, "Please choose or type a model in Settings.");
    if (!business) return showErr(err, "Please enter a website link, business name, niche, or idea.");
    saveSettings();

    const params = {
      input: business,
      language: document.querySelector('input[name="lang"]:checked').value,
      brand: $("byline").value.trim(),
    };
    const cfg = { apiKey, model, online: $("online").checked };
    RUN_NAME = business;

    $("runBtn").disabled = true;
    $("results").style.display = "none";
    $("progress").style.display = "block";
    $("runError").style.display = "none";
    renderStages(0, false);
    startTimer();

    try {
      RESULT = await window.BMB.run(cfg, params, (i) => renderStages(i, false));
      const seconds = stopTimer();
      renderStages(0, true);
      RESULT._seconds = seconds;
      await saveProject(business, cfg, params, RESULT, seconds);
      showResults();
    } catch (e) {
      stopTimer();
      const msg = (e && e.message ? e.message : String(e));
      const re = $("runError");
      re.style.display = "block";
      re.textContent = "Something went wrong: " + msg + "\n\n" + hint(msg) +
        "\n\nThe steps that finished are saved. Running the same business again resumes from there.";
    } finally {
      $("runBtn").disabled = false;
      renderResume();
    }
  });

  function hint(msg) {
    if (/ 401/.test(msg)) return "That looks like a bad or missing API key. Re-enter it in Settings.";
    if (/ 402/.test(msg)) return "Your OpenRouter account needs credit for this model, or pick a cheaper one in Settings.";
    if (/ 429/.test(msg)) return "Rate limit hit, which is common on free models. Wait a minute and run again, or switch to a paid model.";
    if (/ 404/.test(msg)) return "That model id does not exist on OpenRouter. Check the id in Settings.";
    if (/timed out/i.test(msg)) return "The model took too long to answer. Try again, or pick a faster model in Settings.";
    return "Check your OpenRouter key and credits, or try a different model in Settings, then run again.";
  }

  function showErr(el, msg) { el.style.display = "block"; el.textContent = msg; }

  function renderUsage(usage, seconds) {
    const u = usage || { prompt: 0, completion: 0, cost: 0 };
    const total = (u.prompt || 0) + (u.completion || 0);
    const stats = [
      ["Time taken", fmtTime(seconds)],
      ["Cost", fmtCost(u.cost)],
      ["Total tokens", fmtNum(total)],
      ["Input tokens", fmtNum(u.prompt)],
      ["Output tokens", fmtNum(u.completion)],
      ["AI calls", fmtNum(u.calls)],
    ];
    $("usage").innerHTML = stats.map((s) => '<div class="stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + "</div></div>").join("");
  }

  function showResults() {
    $("progress").style.display = "none";
    $("results").style.display = "block";
    renderUsage(RESULT.usage, RESULT._seconds);
    setView("report");
    document.querySelectorAll(".tab").forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        setView(t.dataset.view);
      };
    });
    document.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => doDownload(b.dataset.dl)));
    $("results").scrollIntoView({ behavior: "smooth" });
  }

  function setView(v) {
    const map = { report: RESULT.reportHTML, bmc: RESULT.bmcHTML, emc: RESULT.emcHTML };
    $("viewer").srcdoc = map[v] || "<p style='font-family:sans-serif;padding:20px'>Not available.</p>";
  }

  // ---- project library: every finished run, in full, kept until deleted ----
  async function saveProject(business, cfg, params, result, seconds) {
    const record = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2),
      name: business, model: cfg.model, language: params.language, brand: params.brand || "",
      date: new Date().toISOString(), seconds: Math.round(seconds),
      usage: result.usage || { prompt: 0, completion: 0, cost: 0, calls: 0 },
      reportHTML: result.reportHTML || "", bmcHTML: result.bmcHTML || "",
      emcHTML: result.emcHTML || "", pack: result.pack || "",
    };
    try { await idbPut(record); }
    catch (e) { console.warn("Could not save this project to your local library:", e); }
    await renderHistory();
  }

  async function renderHistory() {
    let h = [];
    try { h = await idbAll(); } catch (e) { h = []; }
    h.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const avg = $("avg"), list = $("history");
    if (!h.length) {
      avg.innerHTML = "";
      list.innerHTML = '<div class="history-empty">No runs yet. Every project you generate is kept here for good, with its cost, time, and the report itself, so you can reopen or download it later.</div>';
      return;
    }
    const n = h.length;
    const avgSec = h.reduce((a, x) => a + (x.seconds || 0), 0) / n;
    const totCost = h.reduce((a, x) => a + ((x.usage && x.usage.cost) || 0), 0);
    avg.innerHTML =
      '<div class="stat"><div class="k">Projects run</div><div class="v">' + n + "</div></div>" +
      '<div class="stat"><div class="k">Avg time</div><div class="v">' + fmtTime(avgSec) + "</div></div>" +
      '<div class="stat"><div class="k">Avg cost</div><div class="v">' + fmtCost(totCost / n) + "</div></div>" +
      '<div class="stat"><div class="k">Total spent</div><div class="v">' + fmtCost(totCost) + "</div></div>";
    list.innerHTML = h.map((x) => {
      const d = new Date(x.date);
      const when = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const u = x.usage || {};
      const total = (u.prompt || 0) + (u.completion || 0);
      const hasContent = !!(x.reportHTML || x.pack);
      return '<div class="hrow"><span class="hname" title="' + esc(x.name) + '">' + esc(x.name) + '</span>' +
        '<span class="hmeta">' + when + "</span>" +
        '<span class="hmeta">' + fmtNum(total) + " tok &middot; " + fmtTime(x.seconds) + "</span>" +
        '<span class="hmeta">' + fmtCost(u.cost) + "</span>" +
        '<span class="hactions">' +
        (hasContent
          ? '<button class="ghost-btn" data-view="' + x.id + '" type="button">View</button>'
          : '<span class="hmeta">archived</span>') +
        '<button class="ghost-btn danger" data-del="' + x.id + '" type="button">Delete</button></span></div>';
    }).join("") + '<button class="ghost-btn clear" id="clearHist" type="button">Delete all history</button>';

    list.querySelectorAll("[data-view]").forEach((b) => {
      b.onclick = () => { const rec = h.find((x) => x.id === b.dataset.view); if (rec) viewProject(rec); };
    });
    list.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("Delete this project? This cannot be undone.")) return;
        await idbDelete(b.dataset.del);
        renderHistory();
      };
    });
    const cb = $("clearHist");
    if (cb) cb.onclick = async () => {
      if (confirm("Delete every saved project? This cannot be undone.")) { await idbClear(); renderHistory(); }
    };
  }

  function viewProject(rec) {
    RUN_NAME = rec.name;
    RESULT = { reportHTML: rec.reportHTML, bmcHTML: rec.bmcHTML, emcHTML: rec.emcHTML, pack: rec.pack, usage: rec.usage, _seconds: rec.seconds };
    showResults();
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // ---- downloads ----
  // named after the business this pack was actually run for, not whatever is
  // currently typed in the form
  function safeName() {
    return (String(RUN_NAME || "").replace(/[^a-z0-9 \-_]/gi, "").slice(0, 40).trim() || "strategy-pack");
  }
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function doDownload(kind) {
    const n = safeName();
    if (kind === "html") download(n + " - Visual Report.html", RESULT.reportHTML, "text/html");
    else if (kind === "bmc") download(n + " - BMC Canvas.html", RESULT.bmcHTML, "text/html");
    else if (kind === "emc") download(n + " - Empathy Map.html", RESULT.emcHTML, "text/html");
    else if (kind === "md") download(n + " - Strategy Pack.md", RESULT.pack, "text/markdown");
    else if (kind === "doc") download(n + " - Strategy Pack.doc", RESULT.reportHTML, "application/msword");
    else if (kind === "pdf") {
      const w = window.open("", "_blank");
      if (!w) { alert("Please allow popups to save as PDF, then click again."); return; }
      w.document.open(); w.document.write(RESULT.reportHTML); w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 700);
    }
  }

  // initial render
  migrateOldHistory().then(renderHistory);
  renderResume();
})();

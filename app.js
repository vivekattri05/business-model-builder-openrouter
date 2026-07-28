/* Dashboard UI glue. Talks to window.BMB (pipeline.js). */
(function () {
  const $ = (id) => document.getElementById(id);
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  const DEFAULT_MODEL = "anthropic/claude-sonnet-5";
  // Models retired since an earlier version of this app. Anyone with one of these
  // saved gets moved to the current equivalent instead of an empty custom box.
  const RETIRED = {
    "anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-5",
    "openai/gpt-4o-mini": "openai/gpt-5.6-terra",
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
      saveHistory(business, model, RESULT.usage, seconds);
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

  // ---- history (per project) ----
  function loadHistory() { try { return JSON.parse(LS.get("bmb_history", "[]")) || []; } catch (e) { return []; } }
  function saveHistory(name, model, usage, seconds) {
    const h = loadHistory();
    const u = usage || {};
    h.unshift({
      name: name, model: model, date: new Date().toISOString(),
      prompt: u.prompt || 0, completion: u.completion || 0,
      total: (u.prompt || 0) + (u.completion || 0), cost: u.cost || 0, seconds: Math.round(seconds),
    });
    LS.set("bmb_history", JSON.stringify(h.slice(0, 25)));
    renderHistory();
  }
  function renderHistory() {
    const h = loadHistory();
    const avg = $("avg"), list = $("history");
    if (!h.length) { avg.innerHTML = ""; list.innerHTML = '<div class="history-empty">No runs yet. Your past projects, tokens, cost, and time will show here.</div>'; return; }
    const n = h.length;
    const avgSec = h.reduce((a, x) => a + (x.seconds || 0), 0) / n;
    const avgCost = h.reduce((a, x) => a + (x.cost || 0), 0) / n;
    const totCost = h.reduce((a, x) => a + (x.cost || 0), 0);
    avg.innerHTML =
      '<div class="stat"><div class="k">Projects run</div><div class="v">' + n + "</div></div>" +
      '<div class="stat"><div class="k">Avg time</div><div class="v">' + fmtTime(avgSec) + "</div></div>" +
      '<div class="stat"><div class="k">Avg cost</div><div class="v">' + fmtCost(avgCost) + "</div></div>" +
      '<div class="stat"><div class="k">Total spent</div><div class="v">' + fmtCost(totCost) + "</div></div>";
    list.innerHTML = h.map((x) => {
      const d = new Date(x.date);
      const when = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return '<div class="hrow"><span class="hname" title="' + esc(x.name) + '">' + esc(x.name) + '</span>' +
        '<span class="hmeta">' + when + "</span>" +
        '<span class="hmeta">' + fmtNum(x.total) + " tok · " + fmtTime(x.seconds) + "</span>" +
        '<span class="hmeta">' + fmtCost(x.cost) + "</span></div>";
    }).join("") + '<button class="ghost-btn clear" id="clearHist" type="button">Clear history</button>';
    const cb = $("clearHist");
    if (cb) cb.onclick = () => { if (confirm("Clear all usage history?")) { LS.set("bmb_history", "[]"); renderHistory(); } };
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
  renderHistory();
  renderResume();
})();

/* Dashboard UI glue. Talks to window.BMB (pipeline.js). */
(function () {
  const $ = (id) => document.getElementById(id);
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // ---- settings load ----
  $("apiKey").value = LS.get("bmb_apiKey", "");
  $("model").value = LS.get("bmb_model", "anthropic/claude-3.5-sonnet");
  if (![].some.call($("model").options, (o) => o.value === $("model").value)) $("model").value = "__custom__";
  $("customModel").value = LS.get("bmb_custom", "");
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

  // ---- stages ----
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

  // ---- run ----
  $("runBtn").addEventListener("click", async () => {
    const apiKey = $("apiKey").value.trim();
    const business = $("business").value.trim();
    const model = modelId();
    const err = $("formError");
    err.style.display = "none";
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

    $("runBtn").disabled = true;
    $("results").style.display = "none";
    $("progress").style.display = "block";
    $("runError").style.display = "none";
    renderStages(0, false);

    try {
      RESULT = await window.BMB.run(cfg, params, (i) => renderStages(i, false));
      renderStages(0, true);
      showResults();
    } catch (e) {
      const re = $("runError");
      re.style.display = "block";
      re.textContent = "Something went wrong: " + (e && e.message ? e.message : e) +
        "\n\nTip: check your OpenRouter key and credits, or try a different model in Settings, then run again.";
    } finally {
      $("runBtn").disabled = false;
    }
  });

  function showErr(el, msg) { el.style.display = "block"; el.textContent = msg; }

  function showResults() {
    $("progress").style.display = "none";
    $("results").style.display = "block";
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

  function safeName() {
    return ($("business").value.trim().replace(/[^a-z0-9 \-_]/gi, "").slice(0, 40).trim() || "strategy-pack");
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
})();

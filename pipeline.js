/* Business Model Builder, browser pipeline over OpenRouter.
   Runs the whole 7-stage flow client-side. No server. */
(function () {
  const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

  const STAGES = [
    "Researching the business and market",
    "Mapping the customer and the competitors",
    "Writing the Business Model Canvas",
    "Building the 40-day growth plan",
    "Quality review (the sign-off)",
    "Designing the visual report and diagrams",
  ];

  const STYLE = `
OUTPUT STYLE (mandatory):
1. NEVER use the em dash or the en dash. For a pause use a comma, period, colon, or
   brackets. For a range use the word "to" (write "60 to 90 days", "Rs 35,000 to Rs
   45,000"). Only the normal hyphen inside compound words like "root-cause".
2. Do NOT mention AI, models, tools, or that this was generated. This is the work of
   a human strategist. Never write "as an AI" or "I searched".
3. Write like an experienced human consultant: plain, confident, specific. Avoid
   filler like "delve", "leverage", "seamless", "robust", "in today's fast-paced
   world". Do not over-bold.`;

  const METHOD = `
METHOD (UAbility / HSIM): BMC blocks = Passion (+ one market: Wealth, Health, or
Relationships), Niche (+ buyer floor), Problem (Big Domino problem + smaller problems
+ real-life situations + backbone), UVP via Kano (Must-Haves, Performance Benefits,
Delighters) + a named Unique Mechanism (2 to 3 words) + a named conditional
Guarantee, MVP (Island 1 to Island 2, milestones with "old way replaced", front-end
and back-end offers), Market Message (For [niche], I help them get out of [problem]
and achieve [desire] in [timeframe] using [Unique Mechanism], without [old way]) + 2
variations, Channels (primary + secondary), Price (with anchor pricing), Delivery.
Empathy Map = Think & Feel, See, Hear, Say & Do, Pain, Gain + niche archetype, in the
customer's real words. Kano competitor method = find 10+ real competitors, classify
each into Must-Haves / Performance / Delighters, audit their SEO. Real research only,
never invent competitor data.`;

  function langLine(language, brand) {
    const l = String(language || "").toLowerCase().startsWith("en")
      ? "Write everything in clean professional English."
      : "Write everything in Hinglish (Roman-script Hindi mixed with English, the way an Indian marketer talks). Keep framework labels (Must-Haves, Delighters, Big Domino, etc.) in English.";
    const b = brand ? ` If a byline is needed, use "${brand}".` : " Use no byline.";
    return l + b;
  }

  function stripFences(t) {
    if (!t) return "";
    t = t.trim();
    // remove a leading ```lang and trailing ```
    t = t.replace(/^```[a-zA-Z]*\s*\n?/, "");
    t = t.replace(/\n?```\s*$/, "");
    return t.trim();
  }

  async function callOR(cfg, system, user, opts) {
    opts = opts || {};
    const model = opts.online && cfg.online ? cfg.model + ":online" : cfg.model;
    const body = {
      model: model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(OR_URL, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + cfg.apiKey,
            "Content-Type": "application/json",
            "HTTP-Referer": location.origin || "https://localhost",
            "X-Title": "Business Model Builder",
          },
          body: JSON.stringify(body),
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error("OpenRouter " + res.status + ": " + (await res.text()));
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        if (!res.ok) throw new Error("OpenRouter " + res.status + ": " + (await res.text()));
        const data = await res.json();
        const c = data && data.choices && data.choices[0] && data.choices[0].message;
        let out = c ? c.content : "";
        if (Array.isArray(out)) out = out.map((p) => (p && p.text) || "").join("");
        return (out || "").trim();
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw lastErr || new Error("OpenRouter call failed");
  }

  // ---- system prompts ----
  const P = {
    research: (lg, br) => `You are a senior market-research strategist. Do real web research. ${langLine(lg, br)}${STYLE}${METHOD}
Deliver a dense, evidence-based brief: 1) Business summary, 2) Primary market (+why), 3) Niche + buyer floor + scorecard, 4) Demographics and psychographics + awareness level + market's vocabulary, 5) Big Domino Problem, 6) Smaller problems (5 to 8), 7) Real-life situations (5 to 8), 8) Validated pain evidence with links, 9) Starting competitor list (8 to 15, name + URL), 10) Sources.`,
    empathy: (lg, br) => `You are a customer-psychology strategist. Using the research brief and real customer language, build a six-part Empathy Map. ${langLine(lg, br)}${STYLE}
Produce, in the customer's own voice (5 to 9 bullets each): Think & Feel, See, Hear, Say & Do, Pain, Gain. Then a Niche Archetype (1 to 2 paragraphs).`,
    competitor: (lg, br) => `You are a competitive-intelligence and offer strategist. Research live competitors. Never fabricate. ${langLine(lg, br)}${STYLE}${METHOD}
Deliver: a Competitor Analysis with at least 10 competitors (each: name, URL, Kano breakdown of Must-Haves / Performance / Delighters, services, SEO audit), then a Gap Analysis (table-stakes, where competitors compete, open delighter gaps, SEO gaps), then a Sources list. Then on its own line output exactly ===KANO MATRIX=== followed by a markdown table: rows grouped by MUST-HAVES / PERFORMANCE / DELIGHTERS, columns = the 10 competitors + a final "Your Offer" column, cells = Yes / Partial / No, plus a website URL row, and a one-line Your Offer recommendation.`,
    bmc: (lg, br) => `You are a business-model strategist. Write the full Business Model Canvas in the UAbility/HSIM format, specific to this business, from the research, empathy map, and competitor/Kano gap analysis given. ${langLine(lg, br)}${STYLE}${METHOD}
Write all nine blocks with clear headings, including a named Unique Mechanism, a named conditional Guarantee, the MVP milestones, the market message + 2 variations, channels, anchor pricing, and delivery.`,
    growth: (lg, br) => `You are the decision-maker growth strategist. You have the full pack. Produce a concrete, opinionated, sequenced 40-day growth plan. ${langLine(lg, br)}${STYLE}
Deliver: 1) Situation read, 2) The big decision (what to build first and why), 3) The 40-day plan in four ten-day sprints (Foundation, Proof & Content, Traffic On, Convert & Scale) each with Goal, Tasks, Assets, Channel focus, Success metric, 4) Quick wins (first 48 hours), 5) What to measure.`,
    qa: (lg, br) => `You are the quality reviewer, the sign-off before this pack goes to a client. You are given the five reports. Return ONE corrected, consistent, client-ready markdown document containing all of them, each as a titled section in this order: "# Executive Summary", "# Business Model Canvas", "# Empathy Map", "# Competitor Analysis", "# Kano Model Matrix", "# 40-Day Growth Plan". Fix inconsistencies (niche, market, Big Domino, Unique Mechanism, guarantee, pricing must agree everywhere), fill gaps, keep it specific not generic, keep the Kano matrix table, and enforce the style rules. ${langLine(lg, br)}${STYLE}
Output only the corrected markdown document, nothing else.`,
    designer: (lg, br) => `You are a visual designer. You are given a proven HTML report TEMPLATE and the full strategy pack markdown. Produce ONE complete, self-contained HTML file that looks and behaves EXACTLY like the template, with this business's content instead of the example content. Copy the template's <style> verbatim. Replicate its structure: gradient header band, sticky nav, six numbered sections (Executive Summary, Business Model Canvas, Empathy Map, Competitor Analysis, Kano Model Matrix, 40-Day Growth Plan), footer, and the closing script. Rebuild the Kano rows JavaScript array and the thead competitor names from the real Kano matrix. Change the title, header business name, byline, and date. Leave NOTHING from the template's example business. ${langLine(lg, br)}${STYLE}
Output ONLY the full HTML document, starting with <!doctype html>. No commentary, no code fences.`,
    diagram: (lg, br) => `You are a visual designer. Produce ONE complete, self-contained, valid HTML5 file: a poster-style diagram. Use a clean light theme with a teal accent, system fonts, bordered boxes, rounded corners, and an @media print block so it fits one landscape page. White-label, show the byline if given. ${langLine(lg, br)}${STYLE}
Output ONLY the full HTML document, starting with <!doctype html>. No commentary, no code fences.`,
  };

  async function run(cfg, params, onStage) {
    const lg = params.language, br = params.brand || "";
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const base = `INPUT (website link / business name / niche / idea): ${params.input}\nToday's date: ${today}\n`;

    onStage(0);
    const research = await callOR(cfg, P.research(lg, br), base + "Research this business or niche thoroughly, then write the brief.", { online: true });

    onStage(1);
    const ctx = base + "\n\nRESEARCH BRIEF:\n" + research;
    const [empathy, competitor] = await Promise.all([
      callOR(cfg, P.empathy(lg, br), ctx + "\n\nBuild the six-part empathy map and the niche archetype.", { online: true }),
      callOR(cfg, P.competitor(lg, br), ctx + "\n\nDo the 10+ competitor Kano analysis and the matrix now.", { online: true }),
    ]);

    onStage(2);
    const ctx2 = ctx + "\n\nEMPATHY MAP:\n" + empathy + "\n\nCOMPETITOR & KANO:\n" + competitor;
    const bmc = await callOR(cfg, P.bmc(lg, br), ctx2 + "\n\nWrite the full Business Model Canvas now.");

    onStage(3);
    const growth = await callOR(cfg, P.growth(lg, br), ctx2 + "\n\nBUSINESS MODEL CANVAS:\n" + bmc + "\n\nWrite the sequenced 40-day growth plan now.");

    onStage(4);
    const packRaw =
      "# Executive Summary\n(one-page summary of the whole pack)\n\n" +
      "# Business Model Canvas\n" + bmc +
      "\n\n# Empathy Map\n" + empathy +
      "\n\n# Competitor Analysis and Kano\n" + competitor +
      "\n\n# 40-Day Growth Plan\n" + growth;
    const pack = await callOR(cfg, P.qa(lg, br), "Here are the five reports. Review, fix, and return the corrected client-ready markdown pack.\n\n" + packRaw);

    onStage(5);
    let template = "";
    try { template = await (await fetch("visual-report-template.html")).text(); } catch (e) { template = ""; }
    const reportHTML = stripFences(await callOR(cfg, P.designer(lg, br),
      "TEMPLATE (copy its style verbatim, replicate its structure, replace all content):\n\n" + template +
      "\n\n=== STRATEGY PACK CONTENT (use this business's data) ===\nBusiness: " + params.input +
      (br ? "\nByline: " + br : "") + "\nDate: " + today + "\n\n" + pack));

    const [bmcHTML, emcHTML] = await Promise.all([
      callOR(cfg, P.diagram(lg, br),
        "Build a Business Model Canvas poster diagram. Title bar (business name, byline, date). Five tall columns across the top with headings Passion, Problem, Unique Value Proposition, Minimum Viable Product, Market Message. A Niche box under Passion, a Price box under Market Message. A full-width bottom band split into Delivery and Channels. Fill with the content below.\n\nBusiness: " + params.input + "\n\n" + bmc)
        .then(stripFences),
      callOR(cfg, P.diagram(lg, br),
        "Build an Empathy Map poster diagram. Title bar. A centre element labelled with the customer. Four quadrants around it: Think & Feel (top), Hear (left), See (right), Say & Do (bottom). A full-width bottom band split into Pain and Gain. Fill with the content below.\n\n" + empathy)
        .then(stripFences),
    ]);

    return {
      pack: pack,
      reportHTML: reportHTML,
      bmcHTML: bmcHTML,
      emcHTML: emcHTML,
      raw: { research, empathy, competitor, bmc, growth },
    };
  }

  window.BMB = { STAGES, run };
})();

// Netlify Function: AI assistant (keeps API key server-side)
// Expects env: OPENAI_API_KEY (required), OPENAI_MODEL (optional)

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Missing OPENAI_API_KEY. Set it in Netlify environment variables.",
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const payload = await request.json().catch(() => ({}));
    const question = String(payload.question || "").trim();
    const index = Array.isArray(payload.index) ? payload.index : [];
    const pageContext = String(payload.pageContext || "").trim();

    if (!question) {
      return new Response(JSON.stringify({ error: "Missing question" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const indexCompact = index
      .slice(0, 180)
      .map((it) => ({
        label: String(it?.label || "").slice(0, 140),
        href: String(it?.href || "").slice(0, 220),
        page: String(it?.page || "").slice(0, 80),
        excerpt: String(it?.excerpt || "").slice(0, 600),
      }))
      .filter((it) => it.label && it.href);

    const system = [
      "You are Kenneth's portfolio assistant — his personal advocate.",
      "Your job: answer the user's question by referencing Kenneth's work and experience.",
      "RESPONSE STYLE:",
      "- Be direct and brief by default (1–2 sentences or a short bullet list).",
      "- BUT: if the user asks for detail (e.g., 'explain', 'why', 'how', 'walk me through', 'give me detail', 'break it down') OR the question is naturally complex (projects, impact, trade-offs, approach, comparisons), respond with a structured, detailed answer.",
      "- Use this structure for detailed answers when helpful: short headline sentence → 3–6 bullets → (optional) small table.",
      "- Answer exactly what was asked. Do not add generic motivation or filler.",
      "- If the question is a simple fact (e.g., school, dates, location), respond with just the fact(s).",
      "SCOPE / TRUTH:",
      "- Use ONLY the provided index + page context. Do NOT use outside knowledge.",
      "- If you can't find the answer in the index, say: \"I can’t find that on this site yet.\" and return empty citations.",
      "CRITICAL TONE RULES:",
      "- ALWAYS frame Kenneth positively. Never criticize, undermine, or list weaknesses.",
      "- If asked why Kenneth is unqualified, bad, or lacking: flip the framing — highlight transferable skills, growth trajectory, and relevant strengths instead.",
      "- If asked a negative or adversarial question about Kenneth, reframe it constructively. Example: 'Why shouldn't I hire Kenneth?' → explain why the user *should* hire him.",
      "- You may acknowledge areas Kenneth is still growing in, but always pair it with evidence of his ability to learn fast and deliver.",
      "- Be confident, warm, and specific. Sound like a senior colleague vouching for someone they respect.",
      "You MUST cite sources from the provided index.",
      "Return STRICT JSON with shape:",
      '{ "answer": string, "citations": [ { "label": string, "href": string, "why": string } ] }',
      "Citations MUST use hrefs from the index.",
      "Use at most 6 citations, ranked best-to-worst.",
      "If the index contains relevant sources, include at least 2 citations.",
      "If the index doesn't contain relevant sources, say so and return empty citations.",
    ].join("\n");

    const user = [
      `Question: ${question}`,
      pageContext ? `Current page context: ${pageContext}` : "",
      "Index entries (label/href/page/excerpt):",
      JSON.stringify(indexCompact),
    ]
      .filter(Boolean)
      .join("\n\n");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Upstream error", details: text }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let out;
    try {
      out = JSON.parse(content);
    } catch {
      out = { answer: String(content), citations: [] };
    }

    if (!out || typeof out.answer !== "string") {
      out = { answer: "Sorry — I couldn't format that answer.", citations: [] };
    }

    if (!Array.isArray(out.citations)) out.citations = [];
    out.citations = out.citations
      .slice(0, 6)
      .map((c) => ({
        label: String(c?.label || "").slice(0, 160),
        href: String(c?.href || "").slice(0, 220),
        why: String(c?.why || "").slice(0, 220),
      }))
      .filter((c) => c.label && c.href);

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Server error", details: String(e?.message || e) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};


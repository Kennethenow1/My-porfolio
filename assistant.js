(() => {
  const PAGES = ["about.html", "me.html", "project.html", "experience.html", "research.html"];
  const CACHE_KEY = "assistant-index-v5";
  const CHAT_KEY = "assistant-chat-v1";

  function isMac() {
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  }

  function safeText(el) {
    if (!el) return "";
    if (typeof el === "string") return el.trim();
    return (el.textContent || "").trim();
  }

  function loadChat() {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return null;
  }

  function saveChat(messages) {
    try {
      const saveable = messages.filter(
        (m) => m.kind !== "thinking" && m.kind !== "typing" && m.kind !== "welcome"
      );
      localStorage.setItem(CHAT_KEY, JSON.stringify(saveable));
    } catch {}
  }

  function clearChat() {
    try { localStorage.removeItem(CHAT_KEY); } catch {}
  }

  function indexCurrentPageDOM() {
    const out = [];
    const page = location.pathname.split("/").pop() || "index.html";
    const title =
      safeText(document.querySelector("h1")) ||
      safeText(document.querySelector("title")) ||
      page;

    // Index visible intro/hero copy even when it isn't inside an [id] section.
    const introEl =
      document.querySelector('[aria-label="Intro"]') ||
      document.querySelector(".about-fun") ||
      document.querySelector(".about-intro p") ||
      document.querySelector("main p");
    const introText = safeText(introEl);
    if (introText && introText.length > 40) {
      out.push({
        label: `Intro — ${title}`,
        href: `${page}#main`,
        page,
        excerpt: introText.slice(0, 320),
      });
    }

    document.querySelectorAll(".site-nav__link[href]").forEach((a) => {
      const label = safeText(a);
      const href = a.getAttribute("href");
      if (label && href) out.push({ label, href, page, excerpt: `Navigate to ${label}.` });
    });

    // Index heading + nearby text even when the section lacks an id.
    document.querySelectorAll("main h1, main h2, main h3").forEach((h) => {
      const heading = safeText(h);
      if (!heading) return;
      let text = "";
      const next = h.nextElementSibling;
      if (next) text = safeText(next);
      if (!text) {
        const p = h.parentElement && h.parentElement.querySelector ? h.parentElement.querySelector("p, li, dd") : null;
        text = safeText(p);
      }
      if (!text) return;
      out.push({
        label: `${heading} — ${title}`,
        href: `${page}#main`,
        page,
        excerpt: text.slice(0, 320),
      });
    });

    const visited = new Set();
    document.querySelectorAll("[id] h1,[id] h2,[id] h3,section[id],article[id],.project-panel[id],.experience-item[id]").forEach((el) => {
      const section = el.closest("[id]");
      if (!section) return;
      const id = section.getAttribute("id");
      if (!id || visited.has(id)) return;
      visited.add(id);
      const h = section.querySelector("h1, h2, h3");
      const label = safeText(h) || id.replace(/[-_]+/g, " ");
      if (!label) return;
      const sectionText = safeText(section).replace(/\s+/g, " ");
      out.push({ label: `${label} — ${title}`, href: `${page}#${id}`, page, excerpt: sectionText.slice(0, 600) });
    });

    document.querySelectorAll("a.project-panel__detail-link[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.endsWith(".html") && !href.startsWith("http")) {
        out.push({ label: safeText(a) || `Details — ${title}`, href, page, excerpt: "Project detail page" });
      }
    });

    return out;
  }

  async function buildSiteIndex() {
    try { sessionStorage.removeItem("assistant-index-v1"); } catch {}
    try { sessionStorage.removeItem("assistant-index-v2"); } catch {}
    try { sessionStorage.removeItem("assistant-index-v3"); } catch {}
    try { sessionStorage.removeItem("assistant-index-v4"); } catch {}

    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= 5) return parsed;
      } catch {}
    }

    const out = indexCurrentPageDOM();
    const parser = new DOMParser();
    const pagesToFetch = new Set(PAGES);
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("#")[0].split("?")[0];
      if (href && href.endsWith(".html") && !href.startsWith("http") && !href.startsWith("mailto")) {
        pagesToFetch.add(href.startsWith("/") ? href.slice(1) : href);
      }
    });

    const currentPage = location.pathname.split("/").pop() || "";

    await Promise.allSettled(
      Array.from(pagesToFetch).slice(0, 40).map(async (page) => {
        if (page === currentPage) return;
        let html = "";
        for (const url of [page, `/${page}`, `${location.origin}/${page}`]) {
          try { const r = await fetch(url, { cache: "no-store" }); if (r.ok) { html = await r.text(); break; } } catch {}
        }
        if (!html || html.length < 100) return;
        const doc = parser.parseFromString(html, "text/html");
        const title = safeText(doc.querySelector("h1")) || safeText(doc.querySelector("title")) || page;

        // Index intro/hero copy even when not in an [id] section.
        const introEl =
          doc.querySelector('[aria-label="Intro"]') ||
          doc.querySelector(".about-fun") ||
          doc.querySelector(".about-intro p") ||
          doc.querySelector("main p");
        const introText = safeText(introEl);
        if (introText && introText.length > 40) {
          out.push({
            label: `Intro — ${title}`,
            href: `${page}#main`,
            page,
            excerpt: introText.slice(0, 320),
          });
        }

        doc.querySelectorAll(".site-nav__link[href]").forEach((a) => {
          const label = safeText(a); const href = a.getAttribute("href");
          if (label && href) out.push({ label, href, page, excerpt: `Navigate to ${label}.` });
        });

        // Index heading + nearby text even when the section lacks an id.
        doc.querySelectorAll("main h1, main h2, main h3").forEach((h) => {
          const heading = safeText(h);
          if (!heading) return;
          let text = "";
          const next = h.nextElementSibling;
          if (next) text = safeText(next);
          if (!text) {
            const p = h.parentElement && h.parentElement.querySelector ? h.parentElement.querySelector("p, li, dd") : null;
            text = safeText(p);
          }
          if (!text) return;
          out.push({
            label: `${heading} — ${title}`,
            href: `${page}#main`,
            page,
            excerpt: text.slice(0, 320),
          });
        });

        const visited = new Set();
        doc.querySelectorAll("[id] h1,[id] h2,[id] h3,section[id],article[id],.project-panel[id]").forEach((el) => {
          const section = el.closest("[id]") || el;
          const id = section.getAttribute("id");
          if (!id || visited.has(id)) return;
          visited.add(id);
          const h = section.querySelector("h1, h2, h3") || (section.matches("h1,h2,h3") ? section : null);
          const label = safeText(h) || id.replace(/[-_]+/g, " ");
          if (!label) return;
          const sectionText = safeText(section).replace(/\s+/g, " ");
          out.push({ label: `${label} — ${title}`, href: `${page}#${id}`, page, excerpt: sectionText.slice(0, 600) });
        });

        doc.querySelectorAll("a.project-panel__detail-link[href]").forEach((a) => {
          const href = a.getAttribute("href");
          if (href && href.endsWith(".html") && !href.startsWith("http"))
            out.push({ label: safeText(a) || `Details — ${title}`, href, page, excerpt: "Project detail page" });
        });
      })
    );

    const seen = new Set();
    const deduped = out.filter((it) => {
      if (!it || !it.href || !it.label) return false;
      if (seen.has(it.href)) return false;
      seen.add(it.href);
      return true;
    });
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(deduped)); } catch {}
    return deduped;
  }

  function init() {
    const btn = document.getElementById("assistant-btn") || document.querySelector(".top-actions__assistant");
    const overlay = document.getElementById("assistant-overlay");
    const closeBtn = document.getElementById("assistant-close");
    const input = document.getElementById("assistant-input");
    const form = document.getElementById("assistant-form");
    const body = document.getElementById("assistant-body");
    if (!btn || !overlay || !input || !form || !body) return;

    let messages = [];
    let indexPromise = null;
    let thinkingTimer = null;
    let thinkingSubTimer = null;
    let typingTimer = null;
    let activeAbort = null;

    function stopThinking() {
      if (thinkingTimer) { clearTimeout(thinkingTimer); clearInterval(thinkingTimer); thinkingTimer = null; }
      if (thinkingSubTimer) { clearTimeout(thinkingSubTimer); clearInterval(thinkingSubTimer); thinkingSubTimer = null; }
    }
    function stopTyping() {
      if (typingTimer) { clearTimeout(typingTimer); clearInterval(typingTimer); typingTimer = null; }
      if (typeIntoMessage._raf) { cancelAnimationFrame(typeIntoMessage._raf); typeIntoMessage._raf = null; }
    }
    function abortActiveRequest() { try { if (activeAbort) activeAbort.abort(); } catch {} activeAbort = null; }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function sanitizeHref(href) {
      const raw = String(href || "").trim();
      if (!raw) return "";
      if (raw.startsWith("#") || raw.startsWith("/") || raw.endsWith(".html") || raw.includes(".html#")) return raw;
      if (/^https?:\/\//i.test(raw)) return raw;
      return "";
    }

    function formatInlineMarkdown(text) {
      let s = escapeHtml(text);
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, h) => {
        const safe = sanitizeHref(h);
        const label = escapeHtml(t);
        if (!safe) return label;
        return `<a class="assistant-md__link" href="${escapeHtml(safe)}">${label}</a>`;
      });
      s = s.replace(/\*\*([^*][\s\S]*?)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*])\*([^*\n][\s\S]*?)\*(?!\*)/g, "$1<em>$2</em>");
      return s;
    }

    function renderMarkdownToHtml(md) {
      const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
      let html = "";
      let i = 0;

      function isBlank(line) {
        return !String(line || "").trim();
      }

      function isTableLine(line) {
        // Basic markdown table support: pipes with at least 2 columns.
        const s = String(line || "").trim();
        if (!s.includes("|")) return false;
        const cols = s.split("|").filter((c) => c.trim().length > 0);
        return cols.length >= 2;
      }

      function isTableDivider(line) {
        // e.g. | --- | :---: | ---: |
        const s = String(line || "").trim();
        if (!s.includes("|")) return false;
        const cells = s.split("|").map((c) => c.trim()).filter(Boolean);
        if (!cells.length) return false;
        return cells.every((c) => /^:?-{3,}:?$/.test(c));
      }

      function splitTableRow(line) {
        const s = String(line || "").trim();
        // strip outer pipes
        const t = s.replace(/^\|/, "").replace(/\|$/, "");
        return t.split("|").map((c) => c.trim());
      }

      while (i < lines.length) {
        const line = lines[i];
        if (isBlank(line)) { i++; continue; }

        // Markdown table
        if (isTableLine(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
          const headers = splitTableRow(lines[i]);
          i += 2; // skip header + divider
          const rows = [];
          while (i < lines.length && isTableLine(lines[i]) && !isBlank(lines[i])) {
            rows.push(splitTableRow(lines[i]));
            i++;
          }

          html += `<div class="assistant-md__table-wrap"><table class="assistant-md__table"><thead><tr>`;
          headers.forEach((h) => {
            html += `<th>${formatInlineMarkdown(h)}</th>`;
          });
          html += `</tr></thead><tbody>`;
          rows.forEach((r) => {
            html += `<tr>`;
            for (let c = 0; c < headers.length; c++) {
              html += `<td>${formatInlineMarkdown(r[c] || "")}</td>`;
            }
            html += `</tr>`;
          });
          html += `</tbody></table></div>`;
          continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
          html += "<ol class=\"assistant-md__ol\">";
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
            const item = lines[i].replace(/^\s*\d+\.\s+/, "");
            html += `<li class="assistant-md__li">${formatInlineMarkdown(item)}</li>`;
            i++;
          }
          html += "</ol>";
          continue;
        }

        if (/^\s*-\s+/.test(line)) {
          html += "<ul class=\"assistant-md__ul\">";
          while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
            const item = lines[i].replace(/^\s*-\s+/, "");
            html += `<li class="assistant-md__li">${formatInlineMarkdown(item)}</li>`;
            i++;
          }
          html += "</ul>";
          continue;
        }

        const parts = [];
        while (
          i < lines.length &&
          !isBlank(lines[i]) &&
          !/^\s*\d+\.\s+/.test(lines[i]) &&
          !/^\s*-\s+/.test(lines[i])
        ) {
          parts.push(lines[i]);
          i++;
        }
        const para = parts.join("\n");
        html += `<p class="assistant-md__p">${formatInlineMarkdown(para).replace(/\n/g, "<br/>")}</p>`;
      }

      return html;
    }

    function shouldStickToBottom() {
      const threshold = 80; // px
      return body.scrollHeight - (body.scrollTop + body.clientHeight) < threshold;
    }

    function scrollToBottom(behavior = "auto") {
      try {
        body.scrollTo({ top: body.scrollHeight, behavior });
      } catch {
        body.scrollTop = body.scrollHeight;
      }
    }

    const domCache = {
      rows: [],
      sigs: [],
    };

    function msgSig(m) {
      const cites = Array.isArray(m?.citations) ? m.citations.length : 0;
      if (m && m.kind === "thinking") {
        // For thinking, only track kind + steps (not subline — that updates fast).
        return ["thinking", JSON.stringify(m.steps || []), cites].join("\u241F");
      }
      return [
        m?.role || "",
        m?.kind || "",
        m?.text || "",
        m?.html || "",
        cites,
      ].join("\u241F");
    }

    function buildRow(m) {
      const row = document.createElement("div");
      row.className = `assistant-chat__msg assistant-chat__msg--${m.role}`;
      return row;
    }

    function setBubble(row, m) {
      row.innerHTML = "";

      if (m.kind === "welcome") {
        const panel = document.createElement("div");
        panel.className = "assistant-welcome";
        panel.innerHTML = `
            <div class="assistant-welcome__title">Portfolio Assistant</div>
            <div class="assistant-welcome__sub">Ask about projects, impact, stack, or how I'd approach a problem. I'll answer with sources from this site.</div>
            <div class="assistant-welcome__chips" data-mount></div>
            <div class="assistant-welcome__hint">${isMac() ? "⌘K" : "Ctrl+K"} open/close · Enter send · Shift+Enter new line</div>`;

        const chipMount = panel.querySelector("[data-mount]");
        [
          "Give me a 30-second pitch of Kenneth's strongest project.",
          "What problems has Kenneth solved, and what was the impact?",
          "Which tech stack does Kenneth use most, and why?",
          "Show evidence of writing/research quality on this site.",
          "If you hired Kenneth, what role would he excel in?",
        ].forEach((text) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "assistant-chip";
          b.textContent = text;
          b.addEventListener("click", () => {
            input.value = text;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
          });
          chipMount.appendChild(b);
        });
        row.appendChild(panel);
        return;
      }

      if (m.kind === "thinking") {
        const panel = document.createElement("div");
        panel.className = "assistant-think";
        panel.innerHTML = `<div class="assistant-think__header"><span class="assistant-think__spinner"></span><span class="assistant-think__title">Thinking</span></div>`;

        const list = document.createElement("div");
        list.className = "assistant-think__steps";
        (m.steps || []).forEach((s) => {
          const step = document.createElement("div");
          step.className = `assistant-think__step${s.done ? " is-done" : s.active ? " is-active" : ""}`;
          step.innerHTML = `<span class="assistant-think__check">${s.done ? "✓" : s.active ? "›" : "·"}</span><span>${s.text}</span>`;
          list.appendChild(step);
        });
        panel.appendChild(list);

        const sub = document.createElement("div");
        sub.className = "assistant-think__sub";
        sub.textContent = m.subline || "";
        panel.appendChild(sub);

        row.appendChild(panel);
        return;
      }

      const bubble = document.createElement("div");
      bubble.className = "assistant-chat__bubble";
      const html = typeof m.html === "string" ? m.html : renderMarkdownToHtml(m.text || "");
      bubble.innerHTML =
        (html || "") +
        (m.kind === "typing" ? `<span class="assistant-typing-caret" aria-hidden="true"></span>` : "");
      if (m.kind === "typing") bubble.classList.add("assistant-chat__bubble--typing");
      row.appendChild(bubble);

      // Only show sources after typing completes.
      if (m.kind !== "typing" && m.citations && m.citations.length) {
        const cites = document.createElement("div");
        cites.className = "assistant-chat__cites";
        const label = document.createElement("div");
        label.className = "assistant-chat__cites-label";
        label.textContent = "Sources:";
        cites.appendChild(label);

        m.citations.forEach((c) => {
          const item = document.createElement("span");
          item.className = "assistant-cite";

          const a = document.createElement("a");
          a.className = "assistant-cite__link";
          a.href = c.href;
          a.textContent = c.label;
          if (c.why) a.title = c.why;
          a.addEventListener("click", (e) => {
            const href = (c && c.href) || "";
            if (href.startsWith("#")) { e.preventDefault(); const t = document.getElementById(href.slice(1)); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); closeAssistant(); return; }
            try { const url = new URL(href, location.href); if (url.origin === location.origin && url.pathname === location.pathname && url.hash) { e.preventDefault(); const t = document.getElementById(url.hash.slice(1)); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); closeAssistant(); return; } } catch {}
            closeAssistant();
          });
          item.appendChild(a);

          if (c.why) {
            const why = document.createElement("span");
            why.className = "assistant-cite__why";
            why.textContent = ` — ${c.why}`;
            item.appendChild(why);
          }
          cites.appendChild(item);
        });
        row.appendChild(cites);
      }
    }

    function render({ forceScrollBottom = false } = {}) {
      const stick = forceScrollBottom || shouldStickToBottom();
      let wrap = body.querySelector(".assistant-chat");
      if (!wrap) {
        body.innerHTML = "";
        wrap = document.createElement("div");
        wrap.className = "assistant-chat";
        body.appendChild(wrap);
        domCache.rows = [];
        domCache.sigs = [];
      }

      // If message count changed, rebuild once (rare).
      if (domCache.rows.length !== messages.length) {
        wrap.innerHTML = "";
        domCache.rows = [];
        domCache.sigs = [];
        messages.forEach((m, idx) => {
          const row = buildRow(m);
          setBubble(row, m);
          wrap.appendChild(row);
          domCache.rows[idx] = row;
          domCache.sigs[idx] = msgSig(m);
        });
      } else {
        messages.forEach((m, idx) => {
          const sig = msgSig(m);
          const row = domCache.rows[idx];

          // Fast path: thinking subline change only (don't touch spinner/steps).
          if (m.kind === "thinking" && sig === domCache.sigs[idx]) {
            const sub = row.querySelector(".assistant-think__sub");
            if (sub && sub.textContent !== (m.subline || "")) {
              sub.textContent = m.subline || "";
            }
            return;
          }

          if (sig === domCache.sigs[idx]) return;

          row.className = `assistant-chat__msg assistant-chat__msg--${m.role}`;
          setBubble(row, m);
          domCache.sigs[idx] = sig;
        });
      }

      if (stick) scrollToBottom("auto");
    }

    function resetChat() {
      abortActiveRequest(); stopThinking(); stopTyping();
      clearChat();
      messages = [{ role: "assistant", kind: "welcome", text: "", citations: [] }];
      render({ forceScrollBottom: true });
      input.focus();
    }

    function openAssistant() {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("assistant-open");
      try { if (overlay._wheelRaf) cancelAnimationFrame(overlay._wheelRaf); } catch {}
      overlay._wheelRaf = null;
      overlay._wheelTarget = null;
      setTimeout(() => input.focus(), 0);
      if (!indexPromise) indexPromise = buildSiteIndex();
      setTimeout(() => {
        render({ forceScrollBottom: true });
        scrollToBottom("smooth");
      }, 0);
    }

    function closeAssistant() {
      abortActiveRequest(); stopThinking();

      // Finalize any in-progress typing so the message isn't left half-done.
      const last = messages.length ? messages[messages.length - 1] : null;
      if (last && last.kind === "typing") {
        stopTyping();
        last.kind = undefined;
        last.html = renderMarkdownToHtml(last.text || "");
        saveChat(messages);
      } else if (last && last.kind === "thinking") {
        stopTyping();
        messages.pop();
      } else {
        stopTyping();
      }
      render();

      // Stop any active assistant wheel animation.
      try { if (overlay._wheelRaf) cancelAnimationFrame(overlay._wheelRaf); } catch {}
      overlay._wheelRaf = null;
      overlay._wheelTarget = null;

      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("assistant-open");
      btn.focus();
    }

    btn.addEventListener("click", openAssistant);
    if (closeBtn) closeBtn.addEventListener("click", closeAssistant);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeAssistant(); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("is-open")) closeAssistant(); });
    window.addEventListener("keydown", (e) => {
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) { e.preventDefault(); overlay.classList.contains("is-open") ? closeAssistant() : openAssistant(); }
    });

    // Clicking links inside assistant messages should behave like citations:
    // close the assistant, then navigate/scroll.
    body.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a.assistant-md__link") : null;
      if (!a) return;
      const href = String(a.getAttribute("href") || "");
      if (!href) return;
      e.preventDefault();
      closeAssistant();

      requestAnimationFrame(() => {
        if (href.startsWith("#")) {
          const t = document.getElementById(href.slice(1));
          if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        try {
          const url = new URL(href, location.href);
          if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
            const t = document.getElementById(url.hash.slice(1));
            if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          // same-origin navigation (including other pages) or external
          location.href = url.href;
        } catch {
          location.href = href;
        }
      });
    });

    // Scrolling behavior:
    // - When pointer is inside assistant body, wheel scrolls the assistant body and NEVER the page.
    //   (This prevents the background from scrolling and then the assistant "jumping" afterward.)
    overlay.addEventListener(
      "wheel",
      (e) => {
        if (!overlay.classList.contains("is-open")) return;
        const inBody = e.target && e.target.closest ? e.target.closest("#assistant-body") : null;
        if (!inBody) return; // let the page scroll normally
        e.preventDefault();
        e.stopPropagation();
        // Smooth wheel scrolling inside assistant (prevents page scroll + avoids choppiness).
        const maxTop = Math.max(0, body.scrollHeight - body.clientHeight);
        if (overlay._wheelTarget == null) overlay._wheelTarget = body.scrollTop;
        overlay._wheelTarget = Math.max(0, Math.min(maxTop, overlay._wheelTarget + e.deltaY));

        if (overlay._wheelRaf) return;
        const step = () => {
          overlay._wheelRaf = null;
          const target = overlay._wheelTarget == null ? body.scrollTop : overlay._wheelTarget;
          const current = body.scrollTop;
          const next = current + (target - current) * 0.35;
          body.scrollTop = next;
          if (Math.abs(target - next) > 0.5) {
            overlay._wheelRaf = requestAnimationFrame(step);
          }
        };
        overlay._wheelRaf = requestAnimationFrame(step);
      },
      { passive: false }
    );

    // --- Inject reset button into header ---
    const header = overlay.querySelector(".assistant-modal__header");
    if (header && !header.querySelector(".assistant-modal__reset")) {
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "assistant-modal__reset";
      resetBtn.setAttribute("aria-label", "New chat");
      resetBtn.textContent = "New chat";
      header.insertBefore(resetBtn, header.querySelector(".assistant-modal__close") || header.lastChild);
      resetBtn.addEventListener("click", resetChat);
    }

    // --- Styles ---
    if (!document.getElementById("assistant-chat-style")) {
      const s = document.createElement("style");
      s.id = "assistant-chat-style";
      s.textContent = `
#assistant-body{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.assistant-chat{display:flex;flex-direction:column;gap:.85rem;padding:.25rem .15rem}
.assistant-chat__msg{display:flex;flex-direction:column;gap:.45rem}
.assistant-chat__msg--user{align-items:flex-end}
.assistant-chat__msg--assistant{align-items:flex-start}
.assistant-chat__bubble{max-width:min(40rem,100%);padding:.8rem .95rem;border-radius:14px;border:1px solid color-mix(in srgb,var(--border) 70%,transparent);background:color-mix(in srgb,var(--bg) 8%,#fff 92%);color:var(--text);line-height:1.6;white-space:pre-wrap;font-size:.925rem;font-family:inherit}
html[data-theme="dark"] .assistant-chat__bubble{background:color-mix(in srgb,var(--bg) 86%,#1f1f23 14%);border-color:rgba(255,255,255,.1)}
.assistant-chat__msg--user .assistant-chat__bubble{background:color-mix(in srgb,var(--text) 92%,var(--bg) 8%);color:var(--bg);border-color:transparent}
html[data-theme="dark"] .assistant-chat__msg--user .assistant-chat__bubble{background:color-mix(in srgb,#fff 92%,var(--bg) 8%);color:#121214}
.assistant-chat__bubble--typing{position:relative}
.assistant-chat__bubble--typing::before{content:"";position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;background:linear-gradient(120deg,transparent,rgba(0,0,0,.06),transparent);opacity:.55;animation:assistant-sheen 1.15s ease-in-out infinite}
html[data-theme="dark"] .assistant-chat__bubble--typing::before{background:linear-gradient(120deg,transparent,rgba(255,255,255,.08),transparent);opacity:.45}
@keyframes assistant-sheen{0%{transform:translateX(-18%)}50%{transform:translateX(18%)}100%{transform:translateX(-18%)}}
.assistant-chat__bubble a{color:inherit;text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--border) 70%,transparent)}
.assistant-chat__bubble a:hover{opacity:.85;border-bottom-color:color-mix(in srgb,var(--text) 55%,transparent)}
.assistant-chat__bubble p{margin:.15rem 0}
.assistant-chat__bubble p:first-child{margin-top:0}
.assistant-chat__bubble p:last-child{margin-bottom:0}
.assistant-md__ol,.assistant-md__ul{margin:.25rem 0 .1rem 1.15rem;padding:0}
.assistant-md__li{margin:.18rem 0}
.assistant-md__table-wrap{margin:.35rem 0 .1rem;overflow:auto;border:1px solid color-mix(in srgb,var(--border) 65%,transparent);border-radius:10px}
.assistant-md__table{width:100%;border-collapse:separate;border-spacing:0;background:transparent;font-size:.86rem;line-height:1.35}
.assistant-md__table th,.assistant-md__table td{padding:.5rem .6rem;vertical-align:top;border-bottom:1px solid color-mix(in srgb,var(--border) 55%,transparent)}
.assistant-md__table th{font-weight:650;color:var(--text);background:color-mix(in srgb,var(--bg) 10%,#fff 90%)}
html[data-theme="dark"] .assistant-md__table th{background:color-mix(in srgb,var(--bg) 88%,#1f1f23 12%)}
.assistant-md__table tr:last-child td{border-bottom:none}
.assistant-md__table td{color:var(--text)}
.assistant-typing-caret{display:inline-block;width:.5ch;height:1em;margin-left:.12ch;vertical-align:-.12em;border-radius:1px;background:currentColor;opacity:.35;animation:assistant-caret 1s steps(2,end) infinite}
@keyframes assistant-caret{50%{opacity:0}}
.assistant-chat__cites{display:flex;flex-direction:column;gap:.35rem;margin-top:.2rem}
.assistant-chat__cites-label{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);opacity:.7}
.assistant-cite{display:block;font-size:.82rem;line-height:1.35;color:var(--muted)}
.assistant-cite__link{color:var(--text);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--border) 70%,transparent);transition:border-color .15s ease,opacity .15s ease}
.assistant-cite__link:hover{opacity:.85;border-bottom-color:color-mix(in srgb,var(--text) 55%,transparent)}
.assistant-cite__why{color:var(--muted);opacity:.85}

.assistant-think{max-width:min(40rem,100%);padding:1rem 1.1rem;border-radius:14px;border:1px solid color-mix(in srgb,var(--border) 60%,transparent);background:color-mix(in srgb,var(--bg) 8%,#fff 92%);color:var(--text);font-family:inherit}
html[data-theme="dark"] .assistant-think{background:color-mix(in srgb,var(--bg) 86%,#1f1f23 14%);border-color:rgba(255,255,255,.1)}
.assistant-think__header{display:flex;align-items:center;gap:.5rem;margin:0 0 .6rem}
.assistant-think__spinner{width:.8rem;height:.8rem;border:2px solid color-mix(in srgb,var(--muted) 22%,transparent);border-top-color:var(--text);border-right-color:color-mix(in srgb,var(--text) 35%,transparent);border-radius:50%;animation:assistant-spin .55s linear infinite;flex-shrink:0;will-change:transform}
@keyframes assistant-spin{to{transform:rotate(360deg)}}
.assistant-think__title{font-weight:600;font-size:.875rem;letter-spacing:.01em}
.assistant-think__steps{display:flex;flex-direction:column;gap:.25rem;margin:0 0 .45rem}
.assistant-think__step{display:flex;align-items:center;gap:.45rem;font-size:.82rem;line-height:1.35;color:color-mix(in srgb,var(--muted) 55%,transparent);transition:color .35s ease,opacity .35s ease;font-family:inherit}
.assistant-think__step.is-active{color:var(--text);font-weight:500}
.assistant-think__step.is-done{color:var(--muted)}
.assistant-think__check{width:.9rem;text-align:center;flex-shrink:0;font-weight:600;font-size:.72rem}
.assistant-think__step.is-done .assistant-think__check{color:var(--text);opacity:.55}
.assistant-think__step.is-active .assistant-think__check{color:var(--text);animation:assistant-pulse 1.2s ease infinite}
@keyframes assistant-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.assistant-think__sub{padding:.45rem .6rem;border-radius:8px;border:1px solid color-mix(in srgb,var(--border) 50%,transparent);background:color-mix(in srgb,var(--bg) 6%,#fff 94%);color:var(--muted);font-family:inherit;font-size:.74rem;line-height:1.45;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.7}
html[data-theme="dark"] .assistant-think__sub{background:color-mix(in srgb,var(--bg) 92%,#1f1f23 8%);border-color:rgba(255,255,255,.07)}

.assistant-welcome{max-width:min(40rem,100%);padding:1.1rem 1.1rem 1rem;border-radius:14px;border:1px solid color-mix(in srgb,var(--border) 70%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--bg) 6%,#fff 94%),color-mix(in srgb,var(--bg) 18%,#fff 82%))}
html[data-theme="dark"] .assistant-welcome{background:linear-gradient(180deg,color-mix(in srgb,var(--bg) 88%,#1f1f23 12%),color-mix(in srgb,var(--bg) 76%,#1f1f23 24%));border-color:rgba(255,255,255,.1)}
.assistant-welcome__title{font-weight:700;letter-spacing:-.02em;font-size:1rem;margin:0 0 .3rem}
.assistant-welcome__sub{color:var(--muted);font-size:.875rem;line-height:1.5;margin:0 0 .8rem}
.assistant-welcome__chips{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .65rem}
.assistant-chip{appearance:none;border:1px solid color-mix(in srgb,var(--border) 65%,transparent);background:transparent;color:var(--text);padding:.38rem .55rem;border-radius:999px;font:inherit;font-size:.78rem;line-height:1.25;cursor:pointer;transition:transform .15s,border-color .15s,background .15s}
.assistant-chip:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--border) 38%,transparent);background:color-mix(in srgb,var(--bg) 10%,#fff 90%)}
html[data-theme="dark"] .assistant-chip:hover{background:color-mix(in srgb,var(--bg) 88%,#1f1f23 12%)}
.assistant-chip:focus{outline:none}
.assistant-chip:focus-visible{outline:2px solid var(--text);outline-offset:3px}
.assistant-welcome__hint{color:var(--muted);font-size:.74rem;opacity:.6}

.assistant-modal__reset{appearance:none;border:1px solid color-mix(in srgb,var(--border) 65%,transparent);background:transparent;color:var(--muted);padding:.3rem .6rem;border-radius:8px;font:inherit;font-size:.72rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;transition:color .15s,border-color .15s}
.assistant-modal__reset:hover{color:var(--text);border-color:color-mix(in srgb,var(--border) 40%,transparent)}
.assistant-modal__reset:focus{outline:none}
.assistant-modal__reset:focus-visible{outline:2px solid var(--text);outline-offset:3px}
      `;
      document.head.appendChild(s);
    }

    // --- Load persisted chat or start fresh ---
    const saved = loadChat();
    if (saved && saved.length) {
      messages = [{ role: "assistant", kind: "welcome", text: "", citations: [] }, ...saved];
    } else {
      messages = [{ role: "assistant", kind: "welcome", text: "", citations: [] }];
    }
    render({ forceScrollBottom: true });

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    });

    function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 180) + "px"; }
    input.addEventListener("input", autosize);
    autosize();
    input.setAttribute("placeholder", "Ask about impact, projects, tech stack, or how I think… (Enter to send)");

    function typeIntoMessage(message, fullText) {
      stopTyping();
      message.kind = "typing";
      message.text = "";
      message.html = undefined;
      const target = String(fullText || "");
      let i = 0;

      function pauseFor(ch) {
        if (ch === "\n") return 45;
        if (/[.!?]/.test(ch)) return 120;
        if (/[,:;]/.test(ch)) return 60;
        if (ch === " ") return 6;
        return 10;
      }

      function tick() {
        if (i >= target.length) {
          stopTyping();
          message.kind = undefined;
          message.text = target;
          message.html = renderMarkdownToHtml(target);
          render();
          saveChat(messages);
          return;
        }
        const ch = target[i++];
        message.text += ch;

        // Keep markdown formatting live while typing, but avoid janky updates.
        // Update on a steady cadence + batch via rAF.
        const shouldUpdate =
          i === target.length ||
          ch === "\n" ||
          ch === " " ||
          i % 4 === 0;
        if (shouldUpdate) {
          message.html = renderMarkdownToHtml(message.text);
          if (!typeIntoMessage._raf) {
            typeIntoMessage._raf = requestAnimationFrame(() => {
              typeIntoMessage._raf = null;
              render({ forceScrollBottom: true });
            });
          }
        }
        typingTimer = setTimeout(tick, pauseFor(ch));
      }
      tick();
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;

      abortActiveRequest(); stopThinking(); stopTyping();
      input.value = "";
      autosize();

      messages.push({ role: "user", text: q, citations: [] });
      saveChat(messages);
      render({ forceScrollBottom: true });

      const stepLabels = [
        "Understanding your question",
        "Scanning projects & experience",
        "Reading research notes",
        "Cross-referencing evidence",
        "Composing answer",
      ];

      const thinkingMsg = {
        role: "assistant",
        kind: "thinking",
        steps: stepLabels.map((text, i) => ({ text, done: false, active: i === 0 })),
        subline: "",
        citations: [],
      };
      messages.push(thinkingMsg);
      render({ forceScrollBottom: true });

      let index = [];
      try {
        index = await (indexPromise || buildSiteIndex());
        indexPromise = Promise.resolve(index);
      } catch {
        index = indexCurrentPageDOM();
      }

      const labelPool = [];
      const excerptPool = [];
      index.forEach((it) => {
        if (it && it.label) labelPool.push(it.label);
        if (it && it.excerpt) excerptPool.push(it.excerpt);
      });

      let currentStep = 0;
      let sublineIdx = 0;

      function cleanSnippet(s) {
        return String(s || "").replace(/\s+/g, " ").trim();
      }

      function pickLabel() {
        const s = labelPool.length
          ? labelPool[sublineIdx % labelPool.length]
          : "site sections";
        sublineIdx++;
        return cleanSnippet(s);
      }

      function pickExcerpt() {
        const s = excerptPool.length
          ? excerptPool[sublineIdx % excerptPool.length]
          : "site content";
        sublineIdx++;
        return cleanSnippet(s);
      }

      function extractName(labelOrText) {
        const s = cleanSnippet(labelOrText);
        // Common: "Something — Page Title"
        const base = s.split(" — ")[0].trim();
        // Common: "Navigate to About."
        const nav = base.match(/^Navigate to\s+(.+?)\.?$/i);
        if (nav && nav[1]) return nav[1].trim();
        return base || "this section";
      }

      function stepNote(step) {
        const dots = ".".repeat((sublineIdx % 3) + 1);
        if (step <= 0) return `Parsing your question${dots}`;
        if (step === 1) {
          const name = extractName(pickLabel());
          return `Scanning projects & experience${dots} Found “${name}”.`;
        }
        if (step === 2) {
          const name = extractName(pickLabel());
          return `Reviewing research/writing${dots} Noting “${name}”.`;
        }
        if (step === 3) {
          const bit = pickExcerpt().split(/\s+/).slice(0, 10).join(" ");
          return `Cross‑referencing evidence${dots} “${bit}${bit ? "…" : ""}”`;
        }
        return `Drafting a clear answer${dots}`;
      }

      // Claude-style “feedback loop”: rapid, pseudo-written working notes.
      const verbs = [
        "Scanning",
        "Checking",
        "Reading",
        "Linking",
        "Comparing",
        "Summarizing",
        "Verifying",
      ];
      function makeLoopLine() {
        const v = verbs[sublineIdx % verbs.length];
        const name = extractName(pickLabel());
        const bit = pickExcerpt().split(/\s+/).slice(0, 7).join(" ");
        const tail = bit ? ` · “${bit}…”` : "";
        return `${v}: ${name}${tail}`;
      }
      // Start loop immediately (will be cleared by stopThinking()).
      thinkingSubTimer = setInterval(() => {
        if (!overlay.classList.contains("is-open")) return;
        // Keep the step labels in sync but make the subline feel alive.
        thinkingMsg.subline = makeLoopLine();
        render({ forceScrollBottom: true });
      }, 140);

      function advanceThinking() {
        if (currentStep < stepLabels.length) {
          thinkingMsg.steps = stepLabels.map((text, i) => ({ text, done: i < currentStep, active: i === currentStep }));
        }
        // Keep a readable, step-specific sentence occasionally.
        thinkingMsg.subline = stepNote(currentStep);
        render({ forceScrollBottom: true });
        currentStep++;
        if (currentStep <= stepLabels.length) {
          thinkingTimer = setTimeout(advanceThinking, 650 + Math.random() * 350);
        }
      }
      thinkingTimer = setTimeout(advanceThinking, 400);

      const pageContext = document.body?.className || document.querySelector("title")?.textContent || window.location.pathname;

      try {
        activeAbort = new AbortController();
        const res = await fetch("/.netlify/functions/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: q, index, pageContext }),
          signal: activeAbort.signal,
        });
        if (!res.ok) throw new Error(await res.text().catch(() => "") || `HTTP ${res.status}`);
        const data = await res.json();

        stopThinking();
        thinkingMsg.steps = stepLabels.map((text) => ({ text, done: true, active: false }));
        thinkingMsg.subline = "";
        render();
        await new Promise((r) => setTimeout(r, 300));

        messages.pop();
        const msg = { role: "assistant", text: "", citations: Array.isArray(data?.citations) ? data.citations : [] };
        messages.push(msg);
        render();
        typeIntoMessage(msg, data?.answer || "Sorry — I couldn't answer that yet.");
      } catch (err) {
        stopThinking(); stopTyping();
        if (messages.length && messages[messages.length - 1] === thinkingMsg) messages.pop();
        const aborted = err && (err.name === "AbortError" || String(err.message || "").includes("AbortError"));
        messages.push({
          role: "assistant",
          text: aborted ? "Cancelled." : "I couldn't reach the assistant server. Run locally with `npm run dev` (Netlify Dev) and make sure `OPENAI_API_KEY` is set in `.env` or in Netlify env vars.",
          citations: [],
        });
        render();
        saveChat(messages);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

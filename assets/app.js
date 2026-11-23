(function () {
  "use strict";

  const MANIFEST = window.CFX_MANIFEST || { assemblies: [], stats: {}, clientNativeCategories: [], serverNativeCategories: [] };
  const CORE_TYPES = window.CFX_TYPES_CORE || [];
  const EXT_TYPES = window.CFX_TYPES_EXTENSIONS || [];
  const CLIENT_NATIVES = window.CFX_NATIVES_CLIENT || [];
  const SERVER_NATIVES = window.CFX_NATIVES_SERVER || [];

  const BASE_TITLE = "FiveM Enhanced .NET 10 SDK (clrcore-v2) — API Reference";

  // Pre-tag native lists with scope + bare hex (without 0x) for fast search
  for (let i = 0; i < CLIENT_NATIVES.length; i++) {
    const n = CLIENT_NATIVES[i];
    n._scope = "client";
    n._hashLower = (n.h || "").toLowerCase();
    n._hashBare = n._hashLower.startsWith("0x") ? n._hashLower.slice(2) : n._hashLower;
  }
  for (let i = 0; i < SERVER_NATIVES.length; i++) {
    const n = SERVER_NATIVES[i];
    n._scope = "server";
    n._hashLower = (n.h || "").toLowerCase();
    n._hashBare = n._hashLower.startsWith("0x") ? n._hashLower.slice(2) : n._hashLower;
  }
  const ALL_NATIVES = CLIENT_NATIVES.concat(SERVER_NATIVES);

  // Flatten client entity extension methods for the Native view's "Entity Extensions" filter
  const ALL_EXT_METHODS = [];
  for (let i = 0; i < EXT_TYPES.length; i++) {
    const et = EXT_TYPES[i];
    const methods = et.methods || [];
    for (let j = 0; j < methods.length; j++) {
      const m = methods[j];
      ALL_EXT_METHODS.push({
        n: m.displayName || m.name,
        rawName: m.name,
        r: m.returnType || "void",
        s: m.signature || "",
        c: et.displayName,
        typeId: et.id,
        p: (m.parameters || []).map(p => ({ n: p.name, t: p.type, m: p.modifier, d: p.hasDefault ? p.defaultValue : undefined }))
      });
    }
  }

  // Index all types by id and short name
  const typesById = new Map();
  const typesBySimpleName = new Map();

  function registerTypeList(list) {
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      typesById.set(t.id, t);
      const short = t.displayName.replace(/<.*>/, "");
      if (!typesBySimpleName.has(short)) typesBySimpleName.set(short, t.id);
      if (!typesBySimpleName.has(t.displayName)) typesBySimpleName.set(t.displayName, t.id);
    }
  }
  registerTypeList(CORE_TYPES);
  registerTypeList(EXT_TYPES);

  // Canonical hash helpers
  function typeHref(id, member) {
    const base = `#type=${encodeURIComponent(id)}`;
    return member ? `${base}&m=${encodeURIComponent(member)}` : base;
  }
  function nativesHref(scope, category) {
    if (!category || category === "ALL") return `#natives=${encodeURIComponent(scope)}`;
    return `#natives=${encodeURIComponent(scope)}/${encodeURIComponent(category)}`;
  }
  function nativeDeepHref(scope, nativeName) {
    return `#native=${encodeURIComponent(scope)}/${encodeURIComponent(nativeName)}`;
  }
  function fullShareUrl(hashStr) {
    const base = window.location.href.split("#")[0];
    return base + hashStr;
  }

  // Normalize hex query (strips optional 0x prefix for bare-hex matching)
  function stripHexPrefix(s) {
    return s.startsWith("0x") ? s.slice(2) : s;
  }
  function looksLikeHex(s) {
    const bare = stripHexPrefix(s);
    return bare.length >= 4 && /^[0-9a-f]+$/i.test(bare);
  }

  // Build search corpus lazily on first search
  let searchCorpus = null;
  function getSearchCorpus() {
    if (searchCorpus) return searchCorpus;
    const items = [];

    for (const t of typesById.values()) {
      const isExt = t.namespace === "CitizenFX.FiveM.Client.Extensions";
      items.push({
        scope: isExt ? "extensions" : "types",
        kind: t.kind,
        isStatic: !!t.isStatic,
        name: t.displayName,
        nameLower: t.displayName.toLowerCase(),
        acronym: extractAcronym(t.displayName),
        sub: `${t.assembly} · ${t.namespace}`,
        sig: t.declaration,
        sigLower: t.declaration.toLowerCase(),
        hash: "",
        hashBare: "",
        route: typeHref(t.id),
        assembly: t.assembly
      });

      const addMembers = (arr, memberKind) => {
        if (!arr) return;
        for (let i = 0; i < arr.length; i++) {
          const m = arr[i];
          const mName = m.displayName || m.name;
          items.push({
            scope: isExt ? "extensions" : "members",
            kind: memberKind,
            isStatic: !!m.isStatic,
            isAsync: !!m.isAsync,
            name: `${t.displayName}.${mName}`,
            shortName: mName,
            nameLower: mName.toLowerCase(),
            fullNameLower: `${t.displayName}.${mName}`.toLowerCase(),
            acronym: extractAcronym(mName),
            sub: `${t.assembly} · ${t.fullName}`,
            sig: m.signature || mName,
            sigLower: (m.signature || mName).toLowerCase(),
            retLower: (m.returnType || m.type || "").toLowerCase(),
            hash: "",
            hashBare: "",
            route: typeHref(t.id, m.name),
            assembly: t.assembly
          });
        }
      };
      addMembers(t.properties, "property");
      addMembers(t.methods, "method");
      addMembers(t.fields, "field");
      addMembers(t.events, "event");
      if (t.enumValues) {
        for (let i = 0; i < t.enumValues.length; i++) {
          const ev = t.enumValues[i];
          const hl = (ev.hex || "").toLowerCase();
          items.push({
            scope: "members",
            kind: "enum-value",
            name: `${t.displayName}.${ev.name}`,
            shortName: ev.name,
            nameLower: ev.name.toLowerCase(),
            fullNameLower: `${t.displayName}.${ev.name}`.toLowerCase(),
            acronym: extractAcronym(ev.name),
            sub: `${t.assembly} · ${t.fullName} = ${ev.value} (${ev.hex})`,
            sig: `${ev.name} = ${ev.value}`,
            sigLower: `${ev.name} ${ev.value} ${ev.hex}`.toLowerCase(),
            hash: hl,
            hashBare: stripHexPrefix(hl),
            route: typeHref(t.id, ev.name),
            assembly: t.assembly
          });
        }
      }
    }

    for (let i = 0; i < CLIENT_NATIVES.length; i++) {
      const n = CLIENT_NATIVES[i];
      items.push({
        scope: "client-natives",
        kind: "native",
        name: n.n,
        nameLower: n.n.toLowerCase(),
        acronym: extractAcronym(n.n),
        sub: `Client Native · ${n.c}${n.h ? " · " + n.h : ""}`,
        sig: n.s,
        sigLower: n.s.toLowerCase(),
        retLower: n.r.toLowerCase(),
        hash: n._hashLower,
        hashBare: n._hashBare,
        route: nativeDeepHref("client", n.n),
        assembly: "CitizenFX.FiveM.Client"
      });
    }

    for (let i = 0; i < SERVER_NATIVES.length; i++) {
      const n = SERVER_NATIVES[i];
      items.push({
        scope: "server-natives",
        kind: "native",
        name: n.n,
        nameLower: n.n.toLowerCase(),
        acronym: extractAcronym(n.n),
        sub: `Server Native · ${n.c}${n.h ? " · " + n.h : ""}`,
        sig: n.s,
        sigLower: n.s.toLowerCase(),
        retLower: n.r.toLowerCase(),
        hash: n._hashLower,
        hashBare: n._hashBare,
        route: nativeDeepHref("server", n.n),
        assembly: "CitizenFX.FiveM.Server"
      });
    }

    searchCorpus = items;
    return items;
  }

  function extractAcronym(name) {
    let out = "";
    for (let i = 0; i < name.length; i++) {
      const ch = name[i];
      if (ch >= "A" && ch <= "Z") out += ch.toLowerCase();
    }
    return out;
  }

  function fuzzyScore(item, q, qBareHex, qIsHex, qTokens) {
    const nl = item.nameLower;
    if (nl === q) return 1000;
    if (item.hash && (item.hash === q || (qIsHex && item.hashBare === qBareHex))) return 995;
    if (nl.startsWith(q)) return 850 - Math.min(nl.length, 100);
    if (item.fullNameLower && item.fullNameLower.startsWith(q)) return 820;
    if (qIsHex && item.hashBare && item.hashBare.startsWith(qBareHex)) return 810;
    if (qIsHex && item.hashBare && item.hashBare.includes(qBareHex)) return 775;
    if (item.acronym && q.length >= 2 && item.acronym.startsWith(q)) return 740 - item.acronym.length;
    const idx = nl.indexOf(q);
    if (idx >= 0) return 680 - idx * 2 - Math.min(nl.length, 80);
    if (item.fullNameLower && item.fullNameLower.includes(q)) return 620;

    if (qTokens.length > 1) {
      const hay = (item.fullNameLower || nl) + " " + item.sigLower + " " + item.hash + " " + item.hashBare;
      let allMatch = true;
      for (let i = 0; i < qTokens.length; i++) {
        const tok = qTokens[i];
        const tokBare = stripHexPrefix(tok);
        if (!hay.includes(tok) && !(tok !== tokBare && hay.includes(tokBare))) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) return 540;
      return 0;
    }

    if (item.retLower && item.retLower === q) return 420;
    if (item.sigLower.includes(q)) return 360;

    if (q.length >= 3 && q.length <= 24) {
      let qi = 0;
      let gaps = 0;
      for (let i = 0; i < nl.length && qi < q.length; i++) {
        if (nl[i] === q[qi]) qi++;
        else if (qi > 0) gaps++;
      }
      if (qi === q.length) return Math.max(120, 300 - gaps * 4);
    }
    return 0;
  }

  function runSearch(query, scopeFilter = "all", limit = 80) {
    const q = query.trim().toLowerCase();
    if (!q) return { total: 0, results: [] };
    const corpus = getSearchCorpus();
    const tokens = q.split(/\s+/).filter(Boolean);
    const qIsHex = tokens.length === 1 && looksLikeHex(q);
    const qBareHex = qIsHex ? stripHexPrefix(q) : "";
    const matches = [];

    for (let i = 0; i < corpus.length; i++) {
      const item = corpus[i];
      if (scopeFilter !== "all" && item.scope !== scopeFilter) continue;
      let score = fuzzyScore(item, q, qBareHex, qIsHex, tokens);
      if (score > 0) {
        if (item.scope === "types") score += 45;
        else if (item.scope === "members") score += 15;
        matches.push({ item, score });
      }
    }

    matches.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    return { total: matches.length, results: matches.slice(0, limit).map(m => m.item) };
  }

  // Utilities
  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(2) + " MB";
  }

  function fmtBuildDate(iso) {
    if (!iso) return "2026-11-23";
    return String(iso).slice(0, 10);
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 1800);
  }

  function copyText(text, btn, customMsg) {
    const done = () => {
      showToast(customMsg || "Copied to clipboard");
      if (btn) {
        const orig = btn.innerHTML;
        btn.classList.add("copied");
        btn.textContent = "Copied!";
        setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = orig; }, 1200);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, cb) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta);
    cb();
  }

  // Lightweight C# signature syntax highlighter with clickable SDK type links
  const CS_KEYWORDS = new Set([
    "public","private","protected","internal","static","readonly","sealed","abstract","virtual","override",
    "class","struct","interface","enum","delegate","record","ref","out","in","params","this","const",
    "event","operator","implicit","explicit","where","new","get","set","init","required","default","null","true","false","using","async","await","var","return"
  ]);
  const CS_BUILTINS = new Set([
    "void","bool","byte","sbyte","short","ushort","int","uint","long","ulong","float","double","decimal","char","string","object","nint","nuint"
  ]);

  function highlightCSharp(code, linkTypes = true) {
    const tokenRe = /("(?:\\.|[^"\\])*")|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?[fdm]?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = tokenRe.exec(code)) !== null) {
      if (m.index > last) out += esc(code.slice(last, m.index));
      if (m[1]) {
        out += `<span class="syn-str">${esc(m[1])}</span>`;
      } else if (m[2]) {
        out += `<span class="syn-num">${esc(m[2])}</span>`;
      } else if (m[3]) {
        const w = m[3];
        const nextChar = code[m.index + w.length];
        if (CS_KEYWORDS.has(w)) {
          out += `<span class="syn-kw">${w}</span>`;
        } else if (CS_BUILTINS.has(w)) {
          out += `<span class="syn-builtin">${w}</span>`;
        } else if (nextChar === "(") {
          out += `<span class="syn-method">${esc(w)}</span>`;
        } else if (linkTypes && typesBySimpleName.has(w)) {
          const tid = typesBySimpleName.get(w);
          out += `<a class="type-link" href="${typeHref(tid)}">${esc(w)}</a>`;
        } else if (w[0] >= "A" && w[0] <= "Z") {
          out += `<span class="syn-type">${esc(w)}</span>`;
        } else {
          out += esc(w);
        }
      }
      last = m.index + m[0].length;
    }
    if (last < code.length) out += esc(code.slice(last));
    return out;
  }

  function kindMeta(kind, isStatic) {
    if (kind === "class" && isStatic) return { letter: "S", cls: "k-static", badge: "static class", badgeCls: "b-purple" };
    switch (kind) {
      case "interface": return { letter: "I", cls: "k-interface", badge: "interface", badgeCls: "b-cyan" };
      case "struct": return { letter: "S", cls: "k-struct", badge: "struct", badgeCls: "b-green" };
      case "enum": return { letter: "E", cls: "k-enum", badge: "enum", badgeCls: "b-amber" };
      case "attribute": return { letter: "A", cls: "k-attribute", badge: "Attribute", badgeCls: "b-pink" };
      case "delegate": return { letter: "D", cls: "k-delegate", badge: "delegate", badgeCls: "b-coral" };
      case "native": return { letter: "N", cls: "k-native", badge: "Native", badgeCls: "b-amber" };
      default: return { letter: "C", cls: "k-class", badge: "class", badgeCls: "b-blue" };
    }
  }

  function asmShortBadge(asmName) {
    if (asmName === "CitizenFX.Base") return `<span class="badge b-gray">Base</span>`;
    if (asmName === "CitizenFX.FiveM.Shared") return `<span class="badge b-purple">Shared</span>`;
    if (asmName === "CitizenFX.FiveM.Client") return `<span class="badge b-blue">Client</span>`;
    if (asmName === "CitizenFX.FiveM.Server") return `<span class="badge b-green">Server</span>`;
    return `<span class="badge b-gray">${esc(asmName)}</span>`;
  }

  // ==================== FOOTER ====================
  function renderFooter() {
    const footerEl = document.getElementById("site-footer");
    if (!footerEl) return;
    const buildDate = fmtBuildDate(MANIFEST.generatedAt);
    footerEl.innerHTML = `
      <div class="footer-inner">
        <div class="footer-note">
          Unofficial community reference generated via binary reflection of official NuGet packages (<code>0.0.5-alpha</code>, <code>net10.0</code>). Not affiliated with Cfx.re or Rockstar Games.
        </div>
        <div class="footer-meta">
          <span>Maintained by <a href="https://nullptrpup.dev" target="_blank" rel="noopener noreferrer"><strong>nullptrpup</strong> (<code>nullptrpup.dev</code>)</a></span>
          <span class="badge b-blue">SDK 0.0.5-alpha</span>
          <span class="badge b-gray">net10.0 · Built ${esc(buildDate)}</span>
        </div>
      </div>
    `;
  }

  // ==================== SIDEBAR ====================
  const sidebarTree = document.getElementById("sidebar-tree");
  const sidebarFilter = document.getElementById("sidebar-filter");

  function renderSidebar(filterText = "") {
    const q = filterText.trim().toLowerCase();
    const html = [];

    html.push(`<div class="tree-section-label">Assemblies &amp; Types</div>`);
    for (const asm of MANIFEST.assemblies) {
      const nsHtml = [];
      let asmMatches = 0;

      for (const ns of asm.namespaces) {
        const matchingTypes = ns.types.filter(t => {
          if (!q) return true;
          return t.name.toLowerCase().includes(q) || ns.name.toLowerCase().includes(q) || asm.name.toLowerCase().includes(q);
        });
        if (matchingTypes.length === 0) continue;
        asmMatches += matchingTypes.length;

        const nsOpen = q ? " open" : (asm.name === "CitizenFX.FiveM.Shared" && ns.name === "CitizenFX.FiveM.Shared.Script" ? " open" : "");
        const itemsHtml = matchingTypes.map(t => {
          const km = kindMeta(t.kind, t.isStatic);
          const href = t.isNativeClass
            ? nativesHref(t.nativeScope)
            : typeHref(t.id);
          return `<a class="tree-item" data-id="${esc(t.id)}" href="${href}" title="${esc(ns.name + '.' + t.name)}">
            <span class="k-icon ${km.cls}">${km.letter}</span>
            <span style="overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</span>
            ${t.count ? `<span class="tree-count">${t.count}</span>` : ""}
          </a>`;
        }).join("");

        nsHtml.push(`<div class="tree-group${nsOpen}" data-ns="${esc(asm.name + '::' + ns.name)}">
          <button class="tree-toggle tree-ns-toggle" type="button">
            <svg class="tree-caret" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
            <span style="overflow:hidden;text-overflow:ellipsis">${esc(ns.name.replace(/^CitizenFX\./, ""))}</span>
            <span class="tree-count">${matchingTypes.length}</span>
          </button>
          <div class="tree-children">${itemsHtml}</div>
        </div>`);
      }

      if (asmMatches === 0) continue;
      const asmOpen = q || asm.name === "CitizenFX.FiveM.Shared" || asm.name === "CitizenFX.FiveM.Client" ? " open" : "";
      html.push(`<div class="tree-group${asmOpen}" data-asm="${esc(asm.name)}">
        <button class="tree-toggle" type="button">
          <svg class="tree-caret" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
          <span>${esc(asm.name)}</span>
          <span class="tree-count">${asmMatches}</span>
        </button>
        <div class="tree-children">${nsHtml.join("")}</div>
      </div>`);
    }

    if (!q || "native client server extension".includes(q) || MANIFEST.clientNativeCategories.some(c => c.name.toLowerCase().includes(q)) || MANIFEST.serverNativeCategories.some(c => c.name.toLowerCase().includes(q))) {
      html.push(`<div class="tree-section-label">Native Reference</div>`);

      const cCats = MANIFEST.clientNativeCategories.filter(c => !q || c.name.toLowerCase().includes(q) || "client native".includes(q));
      if (cCats.length > 0) {
        html.push(`<div class="tree-group${q ? " open" : ""}" data-native-group="client">
          <button class="tree-toggle" type="button">
            <svg class="tree-caret" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
            <span>Client Natives</span>
            <span class="tree-count">${MANIFEST.stats.clientNatives}</span>
          </button>
          <div class="tree-children">
            <a class="tree-item" data-native-cat="client::ALL" href="${nativesHref('client')}">
              <span class="k-icon k-native">*</span><span>All Client Natives</span><span class="tree-count">${MANIFEST.stats.clientNatives}</span>
            </a>
            ${cCats.map(c => `<a class="tree-item" data-native-cat="client::${esc(c.name)}" href="${nativesHref('client', c.name)}">
              <span class="k-icon k-native">N</span><span style="overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</span><span class="tree-count">${c.count}</span>
            </a>`).join("")}
          </div>
        </div>`);
      }

      const sCats = MANIFEST.serverNativeCategories.filter(c => !q || c.name.toLowerCase().includes(q) || "server native".includes(q));
      if (sCats.length > 0) {
        html.push(`<div class="tree-group${q ? " open" : ""}" data-native-group="server">
          <button class="tree-toggle" type="button">
            <svg class="tree-caret" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
            <span>Server Natives</span>
            <span class="tree-count">${MANIFEST.stats.serverNatives}</span>
          </button>
          <div class="tree-children">
            <a class="tree-item" data-native-cat="server::ALL" href="${nativesHref('server')}">
              <span class="k-icon k-native">*</span><span>All Server Natives</span><span class="tree-count">${MANIFEST.stats.serverNatives}</span>
            </a>
            ${sCats.map(c => `<a class="tree-item" data-native-cat="server::${esc(c.name)}" href="${nativesHref('server', c.name)}">
              <span class="k-icon k-native">N</span><span style="overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</span><span class="tree-count">${c.count}</span>
            </a>`).join("")}
          </div>
        </div>`);
      }
    }

    sidebarTree.innerHTML = html.join("");
    syncSidebarActive(parseRoute(window.location.hash));
  }

  sidebarTree.addEventListener("click", (e) => {
    const toggle = e.target.closest(".tree-toggle");
    if (toggle) {
      toggle.parentElement.classList.toggle("open");
      return;
    }
    const link = e.target.closest("a.tree-item");
    if (link && window.innerWidth <= 960) {
      document.getElementById("sidebar").classList.remove("mobile-open");
    }
  });

  sidebarFilter.addEventListener("input", () => renderSidebar(sidebarFilter.value));

  function syncSidebarActive(parsed) {
    document.querySelectorAll(".tree-item.active, .side-quick-btn.active, .top-nav-link.active").forEach(el => el.classList.remove("active"));

    if (parsed.view === "overview") {
      document.querySelector('.side-quick-btn[data-route="overview"]')?.classList.add("active");
    } else if (parsed.view === "quickstart") {
      document.querySelector('.side-quick-btn[data-route="quickstart"]')?.classList.add("active");
      document.getElementById("nav-quickstart")?.classList.add("active");
    } else if (parsed.view === "natives") {
      if (parsed.scope === "client" || parsed.scope === "all" || parsed.scope === "extensions") {
        document.querySelector('.side-quick-btn[data-route="natives-client"]')?.classList.add("active");
        document.getElementById("nav-client-natives")?.classList.add("active");
      } else if (parsed.scope === "server") {
        document.querySelector('.side-quick-btn[data-route="natives-server"]')?.classList.add("active");
        document.getElementById("nav-server-natives")?.classList.add("active");
      }
      if (parsed.scope === "client" || parsed.scope === "server") {
        const cat = parsed.category || "ALL";
        const el = sidebarTree.querySelector(`.tree-item[data-native-cat="${parsed.scope}::${CSS.escape(cat)}"]`);
        if (el) {
          el.classList.add("active");
          el.closest(".tree-group")?.classList.add("open");
        }
      }
    } else if (parsed.view === "type") {
      const el = sidebarTree.querySelector(`.tree-item[data-id="${CSS.escape(parsed.id)}"]`);
      if (el) {
        el.classList.add("active");
        let grp = el.closest(".tree-group");
        while (grp) {
          grp.classList.add("open");
          grp = grp.parentElement?.closest(".tree-group");
        }
      }
    }
  }

  // ==================== VIEWS ====================
  const contentEl = document.getElementById("content");

  function renderOverview() {
    document.title = BASE_TITLE;
    const s = MANIFEST.stats;
    const sampleClient = `using System.Threading.Tasks;
using CitizenFX.FiveM.Client;
using CitizenFX.FiveM.Client.Script;
using CitizenFX.FiveM.Shared.Script;
using CitizenFX.FiveM.Shared.Serialization;

public class ExampleClientScript : IScript
{
    public void Initialize()
    {
        API.Log.Info("Client script initialized!");
        API.OnEvent("my:localEvent", (string msg) => API.Log.Info(msg));
    }

    [OnTick]
    public async Task OnTickAsync()
    {
        await API.Delay(1000);
        int playerPed = Native.PlayerPedId();
    }

    [OnNetEvent("my:serverPush")]
    public void OnServerPush(string payload) => API.Log.Info(payload);

    [OnCommand("ping")]
    public void OnPing([FromRawCommand] string raw) => API.EmitServer("my:ping", raw);

    [OnNuiCallback("closeUi")]
    public void OnCloseUi(object? data, NuiCallback cb) => cb(new { ok = true });

    [ExportMethod("GetVersion")]
    public string GetVersion() => "1.0.0";
}`;

    const sampleServer = `using System.Threading.Tasks;
using CitizenFX.FiveM.Server;
using CitizenFX.FiveM.Server.Http;
using CitizenFX.FiveM.Shared;
using CitizenFX.FiveM.Shared.Script;
using CitizenFX.FiveM.Shared.Serialization;

public class ExampleServerScript : IScript
{
    public void Initialize()
    {
        API.SetHttpHandler(async (HttpRequest req, HttpResponse res) =>
        {
            string body = await req.ReadBodyAsync();
            res.WriteHead(200);
            res.Send("OK");
        });
    }

    [OnNetEvent("my:ping")]
    public void OnPing([FromSource] CallSource source, string message)
    {
        API.EmitClient(source.Source, "my:serverPush", $"Pong: {message}");
    }

    [OnCommand("status", Restricted = true)]
    public void OnStatus([FromSource] CallSource source)
    {
        API.Log.Info("Online players: {0}", API.Players.Count);
    }
}`;

    const asmRows = MANIFEST.assemblies.map(a => {
      const pkgId = a.packageId || a.name;
      const pkgVer = a.packageVersion || "0.0.5-alpha";
      const relPath = a.assemblyRelativePath || `lib/net10.0/${a.name}.dll`;
      const cliCmd = a.nugetInstallCmd || `dotnet add package ${pkgId} --version ${pkgVer}`;
      return `
        <tr>
          <td>
            <strong>${esc(a.name)}</strong><br/>
            <span style="font-size:11.5px;color:var(--text-muted)">${esc(a.description || "")}</span>
          </td>
          <td><code>${esc(pkgVer)}</code><br/><span style="font-size:11px;color:var(--text-dim)">Asm ${esc(a.version)}</span></td>
          <td><span class="badge b-blue">${esc(a.targetFramework)}</span></td>
          <td><code>${a.typeCount}</code></td>
          <td><code>${fmtBytes(a.fileSizeBytes)}</code></td>
          <td>
            <div class="path-cell"><code>${esc(pkgId)} (${esc(pkgVer)})</code> &rarr; <code>${esc(relPath)}</code></div>
            <button class="copy-btn" style="margin-top:5px" data-copy="${esc(cliCmd)}" title="${esc(cliCmd)}">Copy NuGet CLI</button>
          </td>
        </tr>
      `;
    }).join("");

    const hostAttrs = MANIFEST.assemblies
      .filter(a => a.attributes && a.attributes.length)
      .map(a => `<div style="margin-bottom:8px">${asmShortBadge(a.name)} <code style="font-size:12px;color:var(--syn-attr)">${a.attributes.map(esc).join("  ")}</code></div>`)
      .join("");

    const lifecycleTypes = [
      { id: "CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.IScript", role: "Script entry interface (void Initialize())" },
      { id: "CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.OnTickAttribute", role: "Runs method every tick on TickManager" },
      { id: "CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.OnEventAttribute", role: "Local (or network) event handler (Name, AllowNetwork)" },
      { id: "CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.OnNetEventAttribute", role: "Networked event handler (inherits OnEventAttribute)" },
      { id: "CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.OnCommandAttribute", role: "Chat/console command handler (Command, Restricted)" },
      { id: "CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.ExportMethodAttribute", role: "Exposes method as a resource export (Name)" },
      { id: "CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.Script.OnNuiCallbackAttribute", role: "Client NUI callback registration (Name + NuiCallback)" },
      { id: "CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Serialization.FromSourceAttribute", role: "Binds CallSource / source ID parameter in handlers" },
      { id: "CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Serialization.FromRawCommandAttribute", role: "Binds full raw command string parameter" },
      { id: "CitizenFX.Base::CitizenFX.Base.RuntimeAssemblyHintAttribute", role: "Assembly-level client/server runtime assembly mapping" },
    ];

    contentEl.innerHTML = `
      <div class="hero">
        <div class="hero-badges">
          <span class="badge b-blue">.NET 10.0 (net10.0)</span>
          <span class="badge b-purple">clrcore-v2 · GTAV Enhanced</span>
          <span class="badge b-green">SDK v0.0.5-alpha</span>
          <span class="badge b-gray">Binary Reflection Ground Truth</span>
          <span class="badge b-amber">Zero CDN · Offline Ready</span>
        </div>
        <h1>FiveM Enhanced .NET 10 SDK Documentation</h1>
        <p>Complete API reference reflected directly from the official <code>net10.0</code> CitizenFX NuGet assemblies (<code>CitizenFX.Base</code>, <code>CitizenFX.FiveM.Shared</code>, <code>CitizenFX.FiveM.Client</code>, <code>CitizenFX.FiveM.Server</code>), including exact C# method signatures, nullability annotations, entity wrappers, extension methods, and all 9,213 IL-verified native hashes.</p>
        <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">
          <a href="#quickstart" class="btn btn-primary">Quick Start &amp; Mono Migration Guide &rarr;</a>
          <a href="#natives=client" class="btn">Browse Client Natives (8,813)</a>
          <a href="#natives=server" class="btn">Browse Server Natives (400)</a>
        </div>
      </div>

      <div class="stats-grid">
        <a href="#quickstart" class="stat-card">
          <div class="stat-val" style="color:var(--accent)">${s.assemblies}</div>
          <div class="stat-lbl">net10.0 NuGet Packages</div>
        </a>
        <a href="${typeHref("CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.API")}" class="stat-card">
          <div class="stat-val" style="color:var(--purple)">${s.types}</div>
          <div class="stat-lbl">Public Types</div>
        </a>
        <a href="${nativesHref("client")}" class="stat-card">
          <div class="stat-val" style="color:var(--amber)">${s.clientNatives.toLocaleString()}</div>
          <div class="stat-lbl">Client Native Methods</div>
        </a>
        <a href="${nativesHref("server")}" class="stat-card">
          <div class="stat-val" style="color:var(--green)">${s.serverNatives.toLocaleString()}</div>
          <div class="stat-lbl">Server Native Methods</div>
        </a>
        <a href="${nativesHref("extensions")}" class="stat-card">
          <div class="stat-val" style="color:var(--cyan)">${s.extensionMethods.toLocaleString()}</div>
          <div class="stat-lbl">Client Entity Extensions</div>
        </a>
      </div>

      <h2 class="section-title">Indexed .NET 10 SDK Assemblies</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Assembly</th>
              <th>Version</th>
              <th>Target Framework</th>
              <th>Types</th>
              <th>Size</th>
              <th>NuGet Package &amp; Assembly</th>
            </tr>
          </thead>
          <tbody>${asmRows}</tbody>
        </table>
      </div>

      <div class="card" style="margin-top:14px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">Embedded Assembly &amp; Host Configuration Attributes</div>
        ${hostAttrs}
      </div>

      <h2 class="section-title">Script Lifecycle &amp; Entrypoints</h2>
      <p class="section-sub">Verified <code>clrcore-v2</code> script contracts — implement <code>IScript</code> and decorate methods with attributes from <code>CitizenFX.FiveM.Shared.Script</code> (no legacy Mono <code>BaseScript</code>).</p>

      <div class="table-wrap" style="margin-bottom:14px">
        <table class="data-table">
          <thead><tr><th>Type / Attribute</th><th>Assembly</th><th>Verified Signature / Declaration</th><th>Purpose</th></tr></thead>
          <tbody>
            ${lifecycleTypes.map(lt => {
              const t = typesById.get(lt.id);
              if (!t) return "";
              return `<tr>
                <td><a href="${typeHref(t.id)}" style="font-family:var(--font-mono);font-weight:600">${esc(t.displayName)}</a></td>
                <td>${asmShortBadge(t.assembly)}</td>
                <td><code style="font-size:11.8px">${highlightCSharp(t.declaration, false)}</code></td>
                <td style="color:var(--text-muted)">${esc(lt.role)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="grid-2">
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <strong>Client Script Skeleton (Verified .NET 10 APIs)</strong>
            <a href="${typeHref("CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.API")}" style="font-size:12px">View Client.API &rarr;</a>
          </div>
          <div class="code-block">
            <button class="copy-btn" data-copy="${esc(sampleClient)}">Copy</button>
            <pre>${highlightCSharp(sampleClient, false)}</pre>
          </div>
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <strong>Server Script Skeleton (Verified .NET 10 APIs)</strong>
            <a href="${typeHref("CitizenFX.FiveM.Server::CitizenFX.FiveM.Server.API")}" style="font-size:12px">View Server.API &rarr;</a>
          </div>
          <div class="code-block">
            <button class="copy-btn" data-copy="${esc(sampleServer)}">Copy</button>
            <pre>${highlightCSharp(sampleServer, false)}</pre>
          </div>
        </div>
      </div>

      <h2 class="section-title">Core Facades, Entities &amp; Extensions</h2>
      <div class="grid-3">
        ${[
          ["CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.API", "Client API Facade"],
          ["CitizenFX.FiveM.Server::CitizenFX.FiveM.Server.API", "Server API Facade"],
          ["CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.SharedAPI", "Shared API Facade"],
          ["CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.TickManager", "TickManager & Scheduler"],
          ["CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.Entities.Player", "Client Player Entity"],
          ["CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.Entities.Ped", "Client Ped Entity"],
          ["CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.Entities.Vehicle", "Client Vehicle Entity"],
          ["CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.Entities.Prop", "Client Prop Entity"],
          ["CitizenFX.FiveM.Server::CitizenFX.FiveM.Server.Entities.Player", "Server Player Entity"],
          ["CitizenFX.FiveM.Server::CitizenFX.FiveM.Server.Http.HttpRequest", "Server HTTP Request"],
          ["CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.Extensions.PedExtensions", "PedExtensions (828)"],
          ["CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.Extensions.VehicleExtensions", "VehicleExtensions (638)"],
        ].map(([id, label]) => {
          const t = typesById.get(id);
          if (!t) return "";
          return `<a class="cat-card" href="${typeHref(id)}">
            <span>${esc(label)}</span>
            ${asmShortBadge(t.assembly)}
          </a>`;
        }).join("")}
      </div>

      <h2 class="section-title">Client Native Categories (${s.clientNatives.toLocaleString()})</h2>
      <div class="grid-3">
        ${MANIFEST.clientNativeCategories.map(c => `
          <a class="cat-card" href="${nativesHref('client', c.name)}">
            <span>${esc(c.name)}</span>
            <span class="cat-cnt">${c.count}</span>
          </a>
        `).join("")}
      </div>

      <h2 class="section-title">Server Native Categories (${s.serverNatives.toLocaleString()})</h2>
      <div class="grid-3">
        ${MANIFEST.serverNativeCategories.map(c => `
          <a class="cat-card" href="${nativesHref('server', c.name)}">
            <span>${esc(c.name)}</span>
            <span class="cat-cnt">${c.count}</span>
          </a>
        `).join("")}
      </div>
    `;
  }

  // ==================== QUICK START & MIGRATION ====================
  function renderQuickStartPage() {
    document.title = `Quick Start & Migration (Mono vs .NET 10) — ${BASE_TITLE}`;

    const nugetAllCmds = [
      "# Client project",
      "dotnet add package CitizenFX.FiveM.Client --version 0.0.5-alpha",
      "",
      "# Server project",
      "dotnet add package CitizenFX.FiveM.Server --version 0.0.5-alpha",
      "",
      "# Shared library (automatically pulled by Client/Server, or install directly)",
      "dotnet add package CitizenFX.FiveM.Shared --version 0.0.5-alpha",
      "",
      "# Runtime base module (automatically pulled by Shared)",
      "dotnet add package CitizenFX.Base --version 0.0.5-alpha"
    ].join("\n");

    const clientCsproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <AssemblyName>MyResource.Client.net</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <!-- ExcludeAssets="runtime" avoids shipping SDK DLLs already provided by CitizenFX.Host.Client -->
    <PackageReference Include="CitizenFX.FiveM.Client" Version="0.0.5-alpha" ExcludeAssets="runtime" />
  </ItemGroup>
</Project>`;

    const serverCsproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <AssemblyName>MyResource.Server.net</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <!-- ExcludeAssets="runtime" avoids shipping SDK DLLs already provided by CitizenFX.Host.Server -->
    <PackageReference Include="CitizenFX.FiveM.Server" Version="0.0.5-alpha" ExcludeAssets="runtime" />
  </ItemGroup>
</Project>`;

    const fxManifestSample = `fx_version 'cerulean'
game 'gta5'

-- Compiled .NET 10 resource assemblies (*.net.dll)
client_script 'MyResource.Client.net.dll'
server_script 'MyResource.Server.net.dll'`;

    const migrationRows = [
      {
        concept: "Script Entrypoint",
        mono: "public class MyScript : BaseScript",
        net10: "public class MyScript : IScript { public void Initialize() { ... } }",
        link: typeHref("CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.IScript"),
        notes: "No BaseScript inheritance. The runtime discovers IScript implementations via AssemblyHelper.GetScriptAssemblies()."
      },
      {
        concept: "Per-Frame Tick",
        mono: "[Tick] private async Task OnTick() / Tick += OnTick",
        net10: "[OnTick] public async Task OnTickAsync() / API.EveryTick(...)",
        link: typeHref("CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.OnTickAttribute"),
        notes: "Supports both [OnTick] attribute and imperative API.EveryTick, API.SetInterval, API.SetTimeout, API.NextTick."
      },
      {
        concept: "Local Events",
        mono: "[EventHandler(\"name\")] / EventHandlers[\"name\"] += ...",
        net10: "[OnEvent(\"name\")] / API.OnEvent(\"name\", handler)",
        link: typeHref("CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.OnEventAttribute"),
        notes: "Local-only by default; set AllowNetwork = true or use [OnNetEvent] for networked events."
      },
      {
        concept: "Networked Events",
        mono: "[EventHandler(\"name\")] + TriggerServerEvent / TriggerClientEvent",
        net10: "[OnNetEvent(\"name\")] + API.EmitServer / API.EmitClient / API.EmitLocal",
        link: typeHref("CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.OnNetEventAttribute"),
        notes: "Latent transfers use API.EmitServerLatent(...) and API.EmitClientLatent(...)."
      },
      {
        concept: "Commands & Source Binding",
        mono: "[Command(\"cmd\")] + [FromSource] Player player",
        net10: "[OnCommand(\"cmd\", Restricted = false)] + [FromSource] CallSource / [FromRawCommand] string",
        link: typeHref("CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.OnCommandAttribute"),
        notes: "CallSource implicitly converts to int and string; also supports API.Commands.RegisterCommand(...)."
      },
      {
        concept: "Resource Exports",
        mono: "Exports.Add(\"fn\", ...) / Exports[\"res\"].fn()",
        net10: "[ExportMethod(\"fn\")] / API.Exports[\"res\"] / API.Exports.Local",
        link: typeHref("CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.Script.ExportMethodAttribute"),
        notes: "Typed LocalExportAccessor and RemoteExportAccessor backed by MessagePack serialization."
      },
      {
        concept: "NUI Callbacks (Client)",
        mono: "RegisterNuiCallbackType(\"cb\") + EventHandlers[\"__cfx_nui:cb\"]",
        net10: "[OnNuiCallback(\"cb\")] (object? data, NuiCallback cb) / API.OnNuiEvent(...)",
        link: typeHref("CitizenFX.FiveM.Client::CitizenFX.FiveM.Client.Script.OnNuiCallbackAttribute"),
        notes: "First-class Client script attribute with strongly typed NuiCallback delegate."
      },
      {
        concept: "Raw Native Invocation",
        mono: "CitizenFX.Core.Native.API.PlayerPedId()",
        net10: "CitizenFX.FiveM.Client.Native.PlayerPedId() / Server.Native.*",
        link: nativesHref("client"),
        notes: "Raw natives live on static class Native (8,813 Client, 400 Server). Managed runtime helpers live on static class API."
      },
      {
        concept: "Async Delay & Threading",
        mono: "await BaseScript.Delay(100)",
        net10: "await API.Delay(100) / await API.Yield() / await API.JumpToMainThread()",
        link: typeHref("CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.TickManager"),
        notes: "TickManager provides SwitchToMain awaiter and RunOnMainThread(Action) for safe main-thread marshalling."
      },
      {
        concept: "Math & Vectors",
        mono: "CitizenFX.Core.Vector3",
        net10: "System.Numerics.Vector3 (plus ColorRGB / ColorRGBA records)",
        link: typeHref("CitizenFX.Base::CitizenFX.Base.Serialization.CitizenMessagePackExtensionTypeCode"),
        notes: "Uses standard .NET System.Numerics vectors with dedicated CitizenFX MessagePack extension codes (20–23)."
      },
      {
        concept: "Entity Wrappers & Extensions",
        mono: "Game.PlayerPed / Ped / Vehicle / World.*",
        net10: "API.Players / API.Peds / API.Vehicles + CitizenFX.FiveM.Client.Extensions.*",
        link: nativesHref("extensions"),
        notes: "Client & Server share ISharedPed/ISharedVehicle/ISharedPlayer interfaces; Client adds 2,113 fluent extension methods."
      },
      {
        concept: "State Bags",
        mono: "GlobalState / entity.State",
        net10: "API.GlobalState / StateBag.GetForEntity(entity) / IStateBag",
        link: typeHref("CitizenFX.FiveM.Shared::CitizenFX.FiveM.Shared.IStateBag"),
        notes: "Generic Get<T>, TryGet<T>, Set<T>(key, value, replicated), and AddChangeHandler."
      },
      {
        concept: "Server HTTP Endpoint",
        mono: "Legacy HTTP script exports / JS wrapper",
        net10: "API.SetHttpHandler((HttpRequest req, HttpResponse res) => ...)",
        link: typeHref("CitizenFX.FiveM.Server::CitizenFX.FiveM.Server.Http.HttpRequest"),
        notes: "First-class sync HttpHandler and async AsyncHttpHandler with ReadBodyAsync() and WriteHead()."
      }
    ];

    contentEl.innerHTML = `
      <div class="breadcrumb">
        <a href="#/">Overview</a> <span>/</span>
        <span style="color:var(--text)">Quick Start &amp; Migration</span>
      </div>

      <div class="type-header">
        <div class="type-title-row">
          <h1>Quick Start &amp; Mono &rarr; .NET 10 Migration</h1>
          <span class="badge b-blue">net10.0</span>
          <span class="badge b-purple">clrcore-v2</span>
          <span class="badge b-green">0.0.5-alpha</span>
        </div>
        <p style="color:var(--text-muted);margin:0">Everything required to bootstrap a FiveM Enhanced <code>.NET 10</code> resource or migrate an existing legacy Mono (<code>net452</code> / <code>netstandard2.0</code>) C# script to the verified <code>clrcore-v2</code> SDK.</p>
      </div>

      <h2 class="section-title">1. Install Official NuGet Packages (v0.0.5-alpha)</h2>
      <div class="card">
        <div class="code-block">
          <button class="copy-btn" data-copy="${esc(nugetAllCmds)}">Copy All</button>
          <pre>${esc(nugetAllCmds)}</pre>
        </div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px">
          ${MANIFEST.assemblies.map(a => {
            const cmd = a.nugetInstallCmd || `dotnet add package ${a.name} --version ${a.packageVersion}`;
            return `<button class="copy-btn" data-copy="${esc(cmd)}">Copy: ${esc(a.name)}</button>`;
          }).join("")}
        </div>
      </div>

      <h2 class="section-title">2. Minimal <code>.csproj</code> Configuration (<code>net10.0</code>)</h2>
      <div class="grid-2">
        <div class="card">
          <div style="font-weight:600;margin-bottom:8px">Client Project (<code>MyResource.Client.csproj</code>)</div>
          <div class="code-block">
            <button class="copy-btn" data-copy="${esc(clientCsproj)}">Copy</button>
            <pre>${esc(clientCsproj)}</pre>
          </div>
        </div>
        <div class="card">
          <div style="font-weight:600;margin-bottom:8px">Server Project (<code>MyResource.Server.csproj</code>)</div>
          <div class="code-block">
            <button class="copy-btn" data-copy="${esc(serverCsproj)}">Copy</button>
            <pre>${esc(serverCsproj)}</pre>
          </div>
        </div>
      </div>

      <h2 class="section-title">3. Resource Manifest (<code>fxmanifest.lua</code>) &amp; Runtime Host Attributes</h2>
      <div class="card">
        <div class="code-block">
          <button class="copy-btn" data-copy="${esc(fxManifestSample)}">Copy</button>
          <pre>${esc(fxManifestSample)}</pre>
        </div>
        <div class="callout" style="margin-bottom:0">
          <strong>Verified from Local <code>.NET 10</code> Assembly Metadata:</strong><br/>
          &bull; <code>CitizenFX.FiveM.Shared</code> declares <code>[RuntimeAssemblyHint(ClientAssemblyName = "CitizenFX.FiveM.Client", ServerAssemblyName = "CitizenFX.FiveM.Server")]</code> so the <code>clrcore-v2</code> host binds the proper side-specific runtime assembly.<br/>
          &bull; <code>CitizenFX.Base</code> exposes internals to <code>CitizenFX.Host.Client</code> and <code>CitizenFX.Host.Server</code>, and discovers user scripts via <a href="${typeHref("CitizenFX.Base::CitizenFX.Base.AssemblyHelper")}"><code>AssemblyHelper.GetScriptAssemblies()</code></a>.<br/>
          &bull; Use <code>ExcludeAssets="runtime"</code> on SDK package references so your build output does not bundle conflicting copies of host-provided CitizenFX DLLs.
        </div>
      </div>

      <h2 class="section-title">4. Side-by-Side Migration: Legacy Mono vs .NET 10 (<code>clrcore-v2</code>)</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Concept</th>
              <th>Legacy Mono (<code>net452</code>)</th>
              <th>Modern .NET 10 (<code>clrcore-v2</code>)</th>
              <th>Verified Notes</th>
            </tr>
          </thead>
          <tbody>
            ${migrationRows.map(r => `
              <tr>
                <td><strong>${esc(r.concept)}</strong></td>
                <td><span class="mono-old">${esc(r.mono)}</span></td>
                <td><a href="${r.link}" class="net10-new">${esc(r.net10)}</a></td>
                <td style="color:var(--text-muted);font-size:12.5px">${esc(r.notes)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // ==================== TYPE PAGE ====================
  function renderTypePage(typeId, focusMember = "") {
    const t = typesById.get(typeId);
    if (!t) {
      document.title = `Type Not Found — ${BASE_TITLE}`;
      contentEl.innerHTML = `<div class="empty-state">Type not found: <code>${esc(typeId)}</code><br/><br/><a href="#/">Return to Overview</a></div>`;
      return;
    }

    document.title = `${t.displayName} (${t.assembly}) — ${BASE_TITLE}`;

    const km = kindMeta(t.kind, t.isStatic);
    const badges = [asmShortBadge(t.assembly), `<span class="badge ${km.badgeCls}">${km.badge}</span>`];
    if (t.isAbstract && !t.isStatic && t.kind !== "interface") badges.push(`<span class="badge b-gray">abstract</span>`);
    if (t.isSealed && !t.isStatic && t.kind === "class") badges.push(`<span class="badge b-gray">sealed</span>`);
    if (t.isReadOnly) badges.push(`<span class="badge b-green">readonly struct</span>`);
    if (t.isRefStruct) badges.push(`<span class="badge b-coral">ref struct</span>`);
    if (t.isRecord) badges.push(`<span class="badge b-purple">record</span>`);
    if (t.isFlags) badges.push(`<span class="badge b-amber">[Flags]</span>`);
    if (t.isAttribute && t.kind !== "attribute") badges.push(`<span class="badge b-pink">Attribute</span>`);

    const declWithAttrs = (t.attributes && t.attributes.length ? t.attributes.join("\n") + "\n" : "") + t.declaration;

    const metaParts = [];
    if (t.baseType) metaParts.push(`<span><strong>Base:</strong> ${highlightCSharp(t.baseType, true)}</span>`);
    if (t.interfaces && t.interfaces.length) metaParts.push(`<span><strong>Implements:</strong> ${t.interfaces.map(i => highlightCSharp(i, true)).join(", ")}</span>`);
    if (t.underlyingType) metaParts.push(`<span><strong>Underlying Type:</strong> <span class="syn-builtin">${esc(t.underlyingType)}</span></span>`);
    if (t.declaringType) metaParts.push(`<span><strong>Nested In:</strong> ${highlightCSharp(t.declaringType, true)}</span>`);

    const nestedHtml = t.nestedTypes && t.nestedTypes.length ? `
      <div class="card" style="margin-top:12px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Nested Types (${t.nestedTypes.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${t.nestedTypes.map(nid => {
            const nt = typesById.get(nid);
            return nt ? `<a class="pill-btn" href="${typeHref(nid)}">${esc(nt.displayName)}</a>` : "";
          }).join("")}
        </div>
      </div>
    ` : "";

    const counts = {
      constructors: (t.constructors || []).length,
      fields: (t.fields || []).length,
      properties: (t.properties || []).length,
      events: (t.events || []).length,
      methods: (t.methods || []).length,
      enumValues: (t.enumValues || []).length
    };
    const totalMembers = counts.constructors + counts.fields + counts.properties + counts.events + counts.methods + counts.enumValues;

    contentEl.innerHTML = `
      <div class="breadcrumb">
        <a href="#/">Overview</a> <span>/</span>
        <span>${esc(t.assembly)}</span> <span>/</span>
        <span>${esc(t.namespace)}</span> <span>/</span>
        <span style="color:var(--text)">${esc(t.displayName)}</span>
      </div>

      <div class="type-header">
        <div class="type-title-row">
          <h1>${esc(t.displayName)}</h1>
          ${badges.join("")}
          <button class="copy-btn" style="margin-left:auto" data-copy-link="${esc(typeHref(t.id))}" title="Copy direct link to this type">Copy Link</button>
        </div>
        <div class="code-block">
          <button class="copy-btn" data-copy="${esc(declWithAttrs)}">Copy</button>
          <pre>${(t.attributes && t.attributes.length ? `<span class="syn-attr">${esc(t.attributes.join("\n"))}</span>\n` : "") + highlightCSharp(t.declaration, true)}</pre>
        </div>
        ${metaParts.length ? `<div class="meta-strip">${metaParts.join("")}</div>` : ""}
        ${nestedHtml}
      </div>

      ${totalMembers > 0 ? `
        <div class="filter-bar">
          <input id="type-member-filter" type="text" value="${esc(focusMember)}" placeholder="Filter ${totalMembers} members by name, type, or signature..." autocomplete="off" spellcheck="false" />
          <div style="display:flex;flex-wrap:wrap;gap:5px" id="type-section-pills">
            <button class="pill-btn active" data-sec="all">All (${totalMembers})</button>
            ${counts.constructors ? `<button class="pill-btn" data-sec="constructors">Ctors (${counts.constructors})</button>` : ""}
            ${counts.properties ? `<button class="pill-btn" data-sec="properties">Properties (${counts.properties})</button>` : ""}
            ${counts.methods ? `<button class="pill-btn" data-sec="methods">Methods (${counts.methods})</button>` : ""}
            ${counts.fields ? `<button class="pill-btn" data-sec="fields">Fields (${counts.fields})</button>` : ""}
            ${counts.events ? `<button class="pill-btn" data-sec="events">Events (${counts.events})</button>` : ""}
            ${counts.enumValues ? `<button class="pill-btn" data-sec="enumValues">Values (${counts.enumValues})</button>` : ""}
          </div>
        </div>
        <div id="type-members-body"></div>
      ` : (t.kind === "delegate" ? "" : `<div class="empty-state">No public declared members on this type.</div>`)}
    `;

    if (totalMembers > 0) {
      let activeSec = "all";
      let renderLimit = 100;
      const filterInput = document.getElementById("type-member-filter");
      const pillsWrap = document.getElementById("type-section-pills");
      const bodyEl = document.getElementById("type-members-body");

      const drawMembers = () => {
        const q = filterInput.value.trim().toLowerCase();
        const matchStr = (s) => !q || (s && s.toLowerCase().includes(q));
        const sections = [];

        if (t.kind === "enum" && (activeSec === "all" || activeSec === "enumValues")) {
          const vals = (t.enumValues || []).filter(v => matchStr(v.name) || matchStr(v.value) || matchStr(v.hex));
          if (vals.length) {
            sections.push(`
              <h2 class="section-title">Enum Values <span class="badge b-gray">${vals.length}</span></h2>
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Name</th><th>Value</th><th>Hex</th><th>Copy</th></tr></thead>
                  <tbody>
                    ${vals.map(v => `<tr>
                      <td><code>${esc(v.name)}</code>${v.attributes ? `<div class="member-attrs">${esc(v.attributes.join(" "))}</div>` : ""}</td>
                      <td><code class="syn-num">${esc(v.value)}</code></td>
                      <td><code class="syn-num">${esc(v.hex)}</code></td>
                      <td><button class="copy-btn" data-copy="${esc(t.displayName + '.' + v.name)}">Copy</button></td>
                    </tr>`).join("")}
                  </tbody>
                </table>
              </div>
            `);
          }
        }

        const renderMemberList = (title, list, kind) => {
          if (!list || !list.length) return;
          const filtered = list.filter(m => matchStr(m.name) || matchStr(m.signature) || matchStr(m.returnType) || matchStr(m.type));
          if (!filtered.length) return;

          const slice = filtered.slice(0, renderLimit);
          const cards = slice.map(m => renderMemberCard(m, kind, t.id, focusMember)).join("");
          const moreBtn = filtered.length > slice.length ? `
            <div class="load-more-bar">
              <span style="color:var(--text-muted);font-size:12px">Showing ${slice.length} of ${filtered.length}</span>
              <button class="btn btn-primary" data-load-more="100">Load 100 more</button>
              <button class="btn" data-load-more="99999">Show all</button>
            </div>` : "";
          sections.push(`<h2 class="section-title">${title} <span class="badge b-gray">${filtered.length}</span></h2>${cards}${moreBtn}`);
        };

        if (activeSec === "all" || activeSec === "constructors") renderMemberList("Constructors", t.constructors, "ctor");
        if (activeSec === "all" || activeSec === "fields") renderMemberList("Fields", t.fields, "field");
        if (activeSec === "all" || activeSec === "properties") renderMemberList("Properties", t.properties, "property");
        if (activeSec === "all" || activeSec === "events") renderMemberList("Events", t.events, "event");
        if (activeSec === "all" || activeSec === "methods") renderMemberList("Methods", t.methods, "method");

        bodyEl.innerHTML = sections.length ? sections.join("") : `<div class="empty-state">No members match <code>${esc(filterInput.value)}</code>.</div>`;
      };

      filterInput.addEventListener("input", () => { renderLimit = 100; drawMembers(); });
      pillsWrap.addEventListener("click", (e) => {
        const btn = e.target.closest(".pill-btn");
        if (!btn) return;
        pillsWrap.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeSec = btn.dataset.sec;
        renderLimit = 100;
        drawMembers();
      });
      bodyEl.addEventListener("click", (e) => {
        const lm = e.target.closest("[data-load-more]");
        if (lm) {
          renderLimit += parseInt(lm.dataset.loadMore, 10);
          drawMembers();
        }
      });

      drawMembers();
    }
  }

  function renderMemberCard(m, kind, typeId, focusMember) {
    const badges = [];
    if (m.isStatic) badges.push(`<span class="badge b-purple">static</span>`);
    if (m.isAsync) badges.push(`<span class="badge b-cyan">async / Task</span>`);
    if (m.isExtension) badges.push(`<span class="badge b-green">extension</span>`);
    if (m.isOperator) badges.push(`<span class="badge b-amber">operator</span>`);
    if (m.isConst) badges.push(`<span class="badge b-amber">const</span>`);
    if (m.isReadOnly) badges.push(`<span class="badge b-gray">readonly</span>`);
    if (m.isIndexer) badges.push(`<span class="badge b-cyan">indexer</span>`);
    if (m.isInitOnly) badges.push(`<span class="badge b-purple">init</span>`);
    if (m.isRequired) badges.push(`<span class="badge b-coral">required</span>`);
    if (m.isAbstract) badges.push(`<span class="badge b-gray">abstract</span>`);
    if (m.isVirtual) badges.push(`<span class="badge b-gray">virtual</span>`);
    if (m.isOverride) badges.push(`<span class="badge b-gray">override</span>`);
    if (m.visibility && m.visibility !== "public") badges.push(`<span class="badge b-gray">${esc(m.visibility)}</span>`);

    const isFocused = focusMember && m.name && m.name.toLowerCase() === focusMember.toLowerCase();
    const parms = m.parameters || m.indexParameters;
    const parmHtml = parms && parms.length ? `
      <div class="param-list">
        ${parms.map(p => `<span class="param-chip">${p.modifier ? `<span class="p-mod">${esc(p.modifier)}</span> ` : ""}<span class="p-type">${highlightCSharp(p.type, true)}</span> <span class="p-name">${esc(p.name)}</span>${p.hasDefault ? ` <span class="p-def">= ${esc(p.defaultValue)}</span>` : ""}</span>`).join("")}
      </div>` : "";

    return `
      <div class="member-card${isFocused ? " highlighted" : ""}">
        <div class="member-head">
          <div class="member-badges">
            ${m.name ? `<strong style="font-family:var(--font-mono);font-size:13.5px">${esc(m.displayName || m.name)}</strong>` : `<strong style="font-family:var(--font-mono);font-size:13.5px">Constructor</strong>`}
            ${badges.join("")}
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0">
            ${m.name && typeId ? `<button class="copy-btn" data-copy-link="${esc(typeHref(typeId, m.name))}" title="Copy link to member">Link</button>` : ""}
            <button class="copy-btn" data-copy="${esc(m.signature)}">Copy</button>
          </div>
        </div>
        ${m.attributes && m.attributes.length ? `<div class="member-attrs">${esc(m.attributes.join(" "))}</div>` : ""}
        <div class="member-sig">${highlightCSharp(m.signature, true)}</div>
        ${parmHtml}
      </div>
    `;
  }

  // ==================== NATIVES & EXTENSIONS BROWSER ====================
  function renderNativesPage(scope, initialCat = "ALL", initialQuery = "", exactNativeName = "") {
    let activeScope = scope || "client"; // "all" | "client" | "server" | "extensions"
    let selectedCat = initialCat || "ALL";
    let returnFilter = "ALL";
    let onlyBool = false;
    let onlyByRef = false;
    let renderLimit = 80;

    function getDataset(sc) {
      if (sc === "all") return ALL_NATIVES;
      if (sc === "server") return SERVER_NATIVES;
      if (sc === "extensions") return ALL_EXT_METHODS;
      return CLIENT_NATIVES;
    }

    function getCategories(sc) {
      if (sc === "client") return MANIFEST.clientNativeCategories;
      if (sc === "server") return MANIFEST.serverNativeCategories;
      if (sc === "extensions") {
        return EXT_TYPES.map(et => ({ name: et.displayName, count: (et.methods || []).length })).sort((a, b) => b.count - a.count);
      }
      // Combined category counts for "all"
      const m = new Map();
      for (const n of ALL_NATIVES) m.set(n.c, (m.get(n.c) || 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    }

    const list = getDataset(activeScope);
    const cats = getCategories(activeScope);
    const scopeLabel = activeScope === "all" ? "All Natives (Client + Server)"
      : activeScope === "server" ? "Server Native Reference"
      : activeScope === "extensions" ? "Client Entity Extensions"
      : "Client Native Reference";

    document.title = `${scopeLabel}${selectedCat !== "ALL" ? " · " + selectedCat : ""}${exactNativeName ? " · " + exactNativeName : ""} — ${BASE_TITLE}`;

    const retCounts = new Map();
    for (let i = 0; i < list.length; i++) {
      retCounts.set(list[i].r, (retCounts.get(list[i].r) || 0) + 1);
    }
    const topRets = [...retCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);

    const shareHash = exactNativeName
      ? nativeDeepHref(activeScope === "server" ? "server" : "client", exactNativeName)
      : nativesHref(activeScope, selectedCat);

    contentEl.innerHTML = `
      <div class="breadcrumb">
        <a href="#/">Overview</a> <span>/</span>
        <span>${activeScope === "server" ? "CitizenFX.FiveM.Server" : activeScope === "all" ? "Client &amp; Server" : "CitizenFX.FiveM.Client"}</span> <span>/</span>
        <span style="color:var(--text)">${esc(scopeLabel)} (${list.length.toLocaleString()})</span>
      </div>

      <div class="type-header">
        <div class="type-title-row">
          <h1>${esc(scopeLabel)}</h1>
          ${activeScope === "server" ? asmShortBadge("CitizenFX.FiveM.Server") : activeScope === "all" ? (asmShortBadge("CitizenFX.FiveM.Client") + asmShortBadge("CitizenFX.FiveM.Server")) : asmShortBadge("CitizenFX.FiveM.Client")}
          <span class="badge b-amber">${list.length.toLocaleString()} Methods${activeScope !== "extensions" ? " · 100% IL Hashes" : ""}</span>
          <button class="copy-btn" style="margin-left:auto" data-copy-link="${esc(shareHash)}" title="Copy shareable link">Copy Link</button>
        </div>

        <!-- Quick Filter Pills -->
        <div class="native-quick-bar" id="native-quick-pills">
          <a href="${nativesHref('all')}" class="pill-btn ${activeScope === "all" ? "active" : ""}">All (${ALL_NATIVES.length.toLocaleString()})</a>
          <a href="${nativesHref('client')}" class="pill-btn ${activeScope === "client" ? "active" : ""}">Client Only (${CLIENT_NATIVES.length.toLocaleString()})</a>
          <a href="${nativesHref('server')}" class="pill-btn ${activeScope === "server" ? "active" : ""}">Server Only (${SERVER_NATIVES.length.toLocaleString()})</a>
          <button id="native-bool-toggle" class="pill-btn" type="button" title="Only methods returning bool">Returns Bool</button>
          <a href="${nativesHref('extensions')}" class="pill-btn ${activeScope === "extensions" ? "active" : ""}">Entity Extensions (${ALL_EXT_METHODS.length.toLocaleString()})</a>
        </div>
      </div>

      <div class="cat-pills" id="native-cat-pills">
        <button class="pill-btn ${selectedCat === "ALL" ? "active" : ""}" data-cat="ALL">All Categories (${list.length.toLocaleString()})</button>
        ${cats.map(c => `<button class="pill-btn ${selectedCat === c.name ? "active" : ""}" data-cat="${esc(c.name)}">${esc(c.name)} (${c.count})</button>`).join("")}
      </div>

      <div class="filter-bar">
        <input id="native-filter-input" type="text" value="${esc(exactNativeName || initialQuery)}" placeholder="Filter by PascalCase name, 0x hash (or bare hex), parameter, or return type..." autocomplete="off" spellcheck="false" />
        <select id="native-ret-select" title="Filter by return type">
          <option value="ALL">Return: All</option>
          ${topRets.map(([r, cnt]) => `<option value="${esc(r)}">Return: ${esc(r)} (${cnt})</option>`).join("")}
        </select>
        <button id="native-ref-toggle" class="pill-btn" type="button" title="Only methods with ref/out/in parameters">ref / out only</button>
        <span id="native-match-count" style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);padding:0 4px"></span>
      </div>

      <div id="native-results"></div>
    `;

    const inputEl = document.getElementById("native-filter-input");
    const retEl = document.getElementById("native-ret-select");
    const boolBtn = document.getElementById("native-bool-toggle");
    const refBtn = document.getElementById("native-ref-toggle");
    const catWrap = document.getElementById("native-cat-pills");
    const countEl = document.getElementById("native-match-count");
    const resultsEl = document.getElementById("native-results");

    function drawNatives() {
      const q = inputEl.value.trim().toLowerCase();
      const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
      const filtered = [];

      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        if (selectedCat !== "ALL" && n.c !== selectedCat) continue;
        if (onlyBool && n.r !== "bool") continue;
        if (returnFilter !== "ALL" && n.r !== returnFilter) continue;
        if (onlyByRef && !(n.p && n.p.some(p => p.m === "ref" || p.m === "out" || p.m === "in"))) continue;

        if (tokens.length > 0) {
          const hay = (n.n + " " + (n._hashLower || "") + " " + (n._hashBare || "") + " " + n.s + " " + n.c).toLowerCase();
          let ok = true;
          for (let j = 0; j < tokens.length; j++) {
            const tok = tokens[j];
            const bare = stripHexPrefix(tok);
            if (!hay.includes(tok) && !(bare !== tok && hay.includes(bare))) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
        }
        filtered.push(n);
      }

      // If exact deep-link or exact query match exists, lift exact matches to top
      if (q && filtered.length > 1) {
        const qBare = stripHexPrefix(q);
        filtered.sort((a, b) => {
          const aExact = a.n.toLowerCase() === q || a._hashLower === q || (a._hashBare && a._hashBare === qBare) ? 1 : 0;
          const bExact = b.n.toLowerCase() === q || b._hashLower === q || (b._hashBare && b._hashBare === qBare) ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          return 0;
        });
      }

      countEl.textContent = `${filtered.length.toLocaleString()} matches`;

      if (filtered.length === 0) {
        resultsEl.innerHTML = `<div class="empty-state">No methods match your current filter.</div>`;
        return;
      }

      const slice = filtered.slice(0, renderLimit);
      const html = slice.map(n => {
        const isExt = activeScope === "extensions";
        const itemScope = n._scope || activeScope;
        const isHighlighted = exactNativeName && n.n.toLowerCase() === exactNativeName.toLowerCase();
        const callSnippet = isExt
          ? `${n.n}(${(n.p || []).slice(1).map(p => (p.m ? p.m + " " : "") + p.n).join(", ")})`
          : `Native.${n.n}(${(n.p || []).map(p => (p.m ? p.m + " " : "") + p.n).join(", ")})`;
        const linkHash = isExt ? typeHref(n.typeId, n.rawName) : nativeDeepHref(itemScope, n.n);
        const parmsHtml = n.p && n.p.length ? `
          <div class="param-list">
            ${n.p.map(p => `<span class="param-chip">${p.m ? `<span class="p-mod">${esc(p.m)}</span> ` : ""}<span class="p-type">${highlightCSharp(p.t, true)}</span> <span class="p-name">${esc(p.n)}</span>${p.d !== undefined ? ` <span class="p-def">= ${esc(p.d)}</span>` : ""}</span>`).join("")}
          </div>` : "";

        return `
          <div class="member-card${isHighlighted ? " highlighted" : ""}">
            <div class="member-head">
              <div class="member-badges">
                ${isExt
                  ? `<a href="${typeHref(n.typeId, n.rawName)}" style="font-family:var(--font-mono);font-size:13.5px;font-weight:700;color:var(--syn-method)">${esc(n.n)}</a>`
                  : `<strong style="font-family:var(--font-mono);font-size:13.5px;color:var(--syn-method)">${esc(n.n)}</strong>`}
                ${activeScope === "all" ? (itemScope === "server" ? `<span class="badge b-green">Server</span>` : `<span class="badge b-blue">Client</span>`) : ""}
                ${isExt ? `<a href="${typeHref(n.typeId)}" class="badge b-green">${esc(n.c)}</a>` : `<span class="badge b-gray">${esc(n.c)}</span>`}
                <span class="badge b-cyan">&rarr; ${esc(n.r)}</span>
                ${n.h ? `<span class="hash-pill" data-copy="${esc(n.h)}" title="Click to copy native hash">${esc(n.h)}</span>` : ""}
              </div>
              <div style="display:flex;gap:5px;flex-shrink:0">
                <button class="copy-btn" data-copy-link="${esc(linkHash)}" title="Copy direct link">Link</button>
                <button class="copy-btn" data-copy="${esc(callSnippet)}" title="Copy call snippet">Copy Call</button>
                <button class="copy-btn" data-copy="${esc(n.s)}" title="Copy full signature">Copy Sig</button>
              </div>
            </div>
            <div class="member-sig">${highlightCSharp(n.s, true)}</div>
            ${parmsHtml}
          </div>
        `;
      }).join("");

      const moreHtml = filtered.length > slice.length ? `
        <div class="load-more-bar">
          <span style="color:var(--text-muted);font-size:12px">Showing ${slice.length.toLocaleString()} of ${filtered.length.toLocaleString()}</span>
          <button class="btn btn-primary" data-load-more="100">Load 100 more</button>
          ${filtered.length <= 1500 ? `<button class="btn" data-load-more="99999">Show all (${filtered.length})</button>` : ""}
        </div>` : "";

      resultsEl.innerHTML = html + moreHtml;
    }

    let debounce = null;
    inputEl.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { renderLimit = 80; drawNatives(); }, 80);
    });
    retEl.addEventListener("change", () => {
      returnFilter = retEl.value;
      if (returnFilter !== "bool" && onlyBool) {
        onlyBool = false;
        boolBtn.classList.remove("active");
      }
      renderLimit = 80;
      drawNatives();
    });
    boolBtn.addEventListener("click", () => {
      onlyBool = !onlyBool;
      boolBtn.classList.toggle("active", onlyBool);
      if (onlyBool) {
        returnFilter = "ALL";
        retEl.value = "ALL";
      }
      renderLimit = 80;
      drawNatives();
    });
    refBtn.addEventListener("click", () => {
      onlyByRef = !onlyByRef;
      refBtn.classList.toggle("active", onlyByRef);
      renderLimit = 80;
      drawNatives();
    });
    catWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill-btn");
      if (!btn) return;
      const newCat = btn.dataset.cat;
      const targetHash = nativesHref(activeScope, newCat);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else {
        selectedCat = newCat;
        renderLimit = 80;
        drawNatives();
      }
    });
    resultsEl.addEventListener("click", (e) => {
      const lm = e.target.closest("[data-load-more]");
      if (lm) {
        renderLimit += parseInt(lm.dataset.loadMore, 10);
        drawNatives();
      }
    });

    drawNatives();
  }

  // ==================== FULL SEARCH PAGE ====================
  function renderSearchPage(query, scope = "all") {
    document.title = `Search: ${query} — ${BASE_TITLE}`;
    const res = query.trim() ? runSearch(query, scope, 150) : { total: 0, results: [] };
    const scopes = [
      ["all", "All"],
      ["types", "Types"],
      ["members", "Members"],
      ["client-natives", "Client Natives"],
      ["server-natives", "Server Natives"],
      ["extensions", "Entity Extensions"]
    ];

    contentEl.innerHTML = `
      <div class="breadcrumb"><a href="#/">Overview</a> <span>/</span> <span>Search Results</span></div>
      <h1 style="margin:0 0 12px;font-size:22px">Search: <code>${esc(query)}</code> <span class="badge b-blue">${res.total.toLocaleString()} matches</span></h1>
      <div class="cat-pills" id="search-scope-pills">
        ${scopes.map(([k, lbl]) => `<a class="pill-btn ${scope === k ? "active" : ""}" href="#search?q=${encodeURIComponent(query)}&scope=${k}">${lbl}</a>`).join("")}
      </div>
      ${res.results.length ? res.results.map(it => {
        const km = kindMeta(it.kind, it.isStatic);
        return `
          <div class="member-card">
            <div class="member-head">
              <div class="member-badges">
                <span class="k-icon ${km.cls}">${km.letter}</span>
                <a href="${it.route}" style="font-family:var(--font-mono);font-size:13.5px;font-weight:700">${esc(it.name)}</a>
                ${asmShortBadge(it.assembly)}
                <span class="badge b-gray">${esc(it.sub)}</span>
              </div>
              <button class="copy-btn" data-copy="${esc(it.sig)}">Copy</button>
            </div>
            <div class="member-sig">${highlightCSharp(it.sig, false)}</div>
          </div>
        `;
      }).join("") : `<div class="empty-state">No results found for <code>${esc(query)}</code>.</div>`}
    `;
  }

  // ==================== GLOBAL SEARCH DROPDOWN ====================
  const searchInput = document.getElementById("global-search-input");
  const searchDropdown = document.getElementById("search-dropdown");
  const searchClear = document.getElementById("global-search-clear");
  let ddIndex = -1;
  let ddItems = [];

  function closeAndClearSearch(shouldBlur = true) {
    searchInput.value = "";
    searchClear.classList.add("hidden");
    searchDropdown.classList.add("hidden");
    ddItems = [];
    ddIndex = -1;
    if (shouldBlur) searchInput.blur();
  }

  function updateDropdown() {
    const q = searchInput.value.trim();
    searchClear.classList.toggle("hidden", !q);
    if (!q) {
      searchDropdown.classList.add("hidden");
      ddItems = [];
      ddIndex = -1;
      return;
    }
    const { total, results } = runSearch(q, "all", 16);
    ddItems = results;
    ddIndex = results.length ? 0 : -1;

    if (results.length === 0) {
      searchDropdown.innerHTML = `<div class="search-dd-header"><span>No matches for "${esc(q)}"</span></div>`;
      searchDropdown.classList.remove("hidden");
      return;
    }

    searchDropdown.innerHTML = `
      <div class="search-dd-header">
        <span>Top ${results.length} of ${total.toLocaleString()} matches</span>
        <span>&uarr;&darr; navigate · Enter open · Esc clear</span>
      </div>
      ${results.map((it, i) => {
        const km = kindMeta(it.kind, it.isStatic);
        return `<a class="search-dd-item${i === 0 ? " active" : ""}" data-idx="${i}" href="${it.route}">
          <div class="search-dd-row">
            <span class="k-icon ${km.cls}">${km.letter}</span>
            <span class="search-dd-name">${esc(it.name)}</span>
            ${asmShortBadge(it.assembly)}
          </div>
          <div class="search-dd-meta">${esc(it.sub)} — ${esc(it.sig)}</div>
        </a>`;
      }).join("")}
      <div class="search-dd-footer">
        <a href="#search?q=${encodeURIComponent(q)}">View all ${total.toLocaleString()} results for "${esc(q)}" &rarr;</a>
      </div>
    `;
    searchDropdown.classList.remove("hidden");
  }

  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(updateDropdown, 70);
  });

  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim()) updateDropdown();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAndClearSearch(true);
    } else if (e.key === "ArrowDown" && ddItems.length) {
      e.preventDefault();
      ddIndex = (ddIndex + 1) % ddItems.length;
      highlightDdItem();
    } else if (e.key === "ArrowUp" && ddItems.length) {
      e.preventDefault();
      ddIndex = (ddIndex - 1 + ddItems.length) % ddItems.length;
      highlightDdItem();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (ddIndex >= 0 && ddItems[ddIndex]) {
        window.location.hash = ddItems[ddIndex].route;
        searchDropdown.classList.add("hidden");
      } else if (searchInput.value.trim()) {
        window.location.hash = `#search?q=${encodeURIComponent(searchInput.value.trim())}`;
        searchDropdown.classList.add("hidden");
      }
    }
  });

  function highlightDdItem() {
    searchDropdown.querySelectorAll(".search-dd-item").forEach((el, i) => {
      el.classList.toggle("active", i === ddIndex);
      if (i === ddIndex) el.scrollIntoView({ block: "nearest" });
    });
  }

  searchDropdown.addEventListener("click", () => {
    searchDropdown.classList.add("hidden");
  });

  searchClear.addEventListener("click", () => {
    closeAndClearSearch(false);
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".topbar-search")) {
      searchDropdown.classList.add("hidden");
    }
    const copyLinkBtn = e.target.closest("[data-copy-link]");
    if (copyLinkBtn) {
      e.preventDefault();
      copyText(fullShareUrl(copyLinkBtn.getAttribute("data-copy-link")), copyLinkBtn, "Share link copied!");
      return;
    }
    const copyTarget = e.target.closest("[data-copy]");
    if (copyTarget) {
      e.preventDefault();
      copyText(copyTarget.getAttribute("data-copy"), copyTarget.classList.contains("copy-btn") ? copyTarget : null);
    }
  });

  // Global keyboard shortcuts (Ctrl+K, /, Escape)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === "Escape" && !searchDropdown.classList.contains("hidden")) {
      e.preventDefault();
      closeAndClearSearch(true);
    }
  });

  // Sidebar toggle
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    const sb = document.getElementById("sidebar");
    if (window.innerWidth <= 960) sb.classList.toggle("mobile-open");
    else sb.classList.toggle("collapsed");
  });

  // ==================== ROUTER (Supports #type=, #native=, #natives=, #quickstart, #search AND legacy #/ paths) ====================
  function parseRoute(rawHash) {
    const raw = (rawHash || "#/").trim();
    if (!raw || raw === "#" || raw === "#/") return { view: "overview" };

    // #quickstart or #/quickstart
    if (raw === "#quickstart" || raw === "#/quickstart") return { view: "quickstart" };

    // #type=<id>(&m=<member>)
    if (raw.startsWith("#type=")) {
      const rest = raw.slice("#type=".length);
      const [idPart, ...paramParts] = rest.split("&");
      const params = new URLSearchParams(paramParts.join("&"));
      return { view: "type", id: decodeURIComponent(idPart), member: params.get("m") || "" };
    }

    // Legacy #/type/<id>(?m=<member>)
    if (raw.startsWith("#/type/")) {
      const [pathPart, queryPart] = raw.split("?");
      const params = new URLSearchParams(queryPart || "");
      return { view: "type", id: decodeURIComponent(pathPart.slice("#/type/".length)), member: params.get("m") || "" };
    }

    // #native=<scope>/<NativeName> or #native=<NativeName>
    if (raw.startsWith("#native=")) {
      const val = raw.slice("#native=".length);
      const slash = val.indexOf("/");
      if (slash > 0) {
        return {
          view: "natives",
          scope: decodeURIComponent(val.slice(0, slash)),
          category: "ALL",
          query: "",
          exactNative: decodeURIComponent(val.slice(slash + 1))
        };
      }
      return { view: "natives", scope: "all", category: "ALL", query: "", exactNative: decodeURIComponent(val) };
    }

    // #natives=<scope>(/<category>)(?q=...)
    if (raw.startsWith("#natives=")) {
      const [mainPart, queryPart] = raw.split("?");
      const params = new URLSearchParams(queryPart || "");
      const val = mainPart.slice("#natives=".length);
      const slash = val.indexOf("/");
      if (slash > 0) {
        return {
          view: "natives",
          scope: decodeURIComponent(val.slice(0, slash)),
          category: decodeURIComponent(val.slice(slash + 1)),
          query: params.get("q") || ""
        };
      }
      return { view: "natives", scope: decodeURIComponent(val || "client"), category: "ALL", query: params.get("q") || "" };
    }

    // Legacy #/natives/<scope>(/<category>)
    if (raw.startsWith("#/natives/")) {
      const [pathPart, queryPart] = raw.split("?");
      const params = new URLSearchParams(queryPart || "");
      const segs = pathPart.slice("#/natives/".length).split("/");
      return {
        view: "natives",
        scope: decodeURIComponent(segs[0] || "client"),
        category: segs[1] ? decodeURIComponent(segs[1]) : "ALL",
        query: params.get("q") || ""
      };
    }

    // #search?q=... or #/search?q=...
    if (raw.startsWith("#search") || raw.startsWith("#/search")) {
      const queryPart = raw.includes("?") ? raw.split("?")[1] : "";
      const params = new URLSearchParams(queryPart);
      return { view: "search", query: params.get("q") || "", scope: params.get("scope") || "all" };
    }

    return { view: "overview" };
  }

  function route() {
    const parsed = parseRoute(window.location.hash);

    if (parsed.view === "overview") {
      renderOverview();
    } else if (parsed.view === "quickstart") {
      renderQuickStartPage();
    } else if (parsed.view === "type") {
      renderTypePage(parsed.id, parsed.member || "");
    } else if (parsed.view === "natives") {
      renderNativesPage(parsed.scope, parsed.category || "ALL", parsed.query || "", parsed.exactNative || "");
    } else if (parsed.view === "search") {
      renderSearchPage(parsed.query || "", parsed.scope || "all");
    } else {
      renderOverview();
    }

    syncSidebarActive(parsed);
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);

  // Boot
  renderFooter();
  renderSidebar();
  route();
})();

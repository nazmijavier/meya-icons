  // Full-color sets (cursors, flags) are sent once; every style shows that one drawing.
  for (const ic of icons) for (const k in ic.v) if (ic.v[k] === 1) ic.v[k] = ic.v.outline;
  // ---------- Search (shared by the site and the Figma plugin) ----------
  // Matches the name, the related words from scripts/keywords.mjs and the category, word by word.
  // Partial words and plurals always match; one-letter typos are tried only when nothing matches exactly.
  for (const ic of icons) ic.h = [...new Set(`${ic.n.replace(/-/g, " ")} ${ic.k || ""} ${catLabel[ic.c].toLowerCase().replace(/&/g, " ")}`.split(/\s+/).filter(Boolean))];
  const tokensOf = (q) => q.toLowerCase().split(/[\s\-_,./]+/).filter(Boolean);
  // True when a and b differ by at most one inserted, deleted or changed letter.
  function oneOff(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }
  function matches(ic, toks, fuzzy) {
    return toks.every((t) => {
      const forms = [t];
      if (t.length > 3 && t.endsWith("ies")) forms.push(t.slice(0, -3) + "y");
      else if (t.length > 4 && t.endsWith("es")) forms.push(t.slice(0, -2));
      if (t.length > 3 && t.endsWith("s")) forms.push(t.slice(0, -1));
      return ic.h.some((w) => forms.some((f) => w.startsWith(f)) ||
        (fuzzy && t.length >= 4 && (oneOff(w, t) || (w.length > t.length && oneOff(w.slice(0, t.length), t)))));
    });
  }
  // Returns a test for one query: exact first, typo-tolerant only if the exact pass finds nothing in `pool`.
  function searchFor(query, pool) {
    const toks = tokensOf(query);
    if (!toks.length) return () => true;
    const fuzzy = !pool.some((ic) => matches(ic, toks, false));
    return (ic) => matches(ic, toks, fuzzy);
  }

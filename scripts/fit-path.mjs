// Short path data for outlined icons, used by outline.mjs. Skia's stroker writes an offset curve as many short
// quadratic pieces and a round cap as conic arcs, so each smooth curved run between corners is refitted with as
// few cubic curves as stay within TOL of it (Schneider's curve fitting, Graphics Gems 1990), straight edges stay
// straight lines, and everything is written as short relative commands.
export const TOL = 0.004; // the most a refitted curve may stray from the exact outline, in 24-grid units

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1], len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l] : [0, 0]; };

// ---------- Segments: { k: "L" | "Q" | "K" (conic) | "C", p: [points], w } ----------
function evalSeg(s, t) {
  const [p0, p1, p2, p3] = s.p, u = 1 - t;
  if (s.k === "L") return add(mul(p0, u), mul(p1, t));
  if (s.k === "Q") return add(add(mul(p0, u * u), mul(p1, 2 * u * t)), mul(p2, t * t));
  if (s.k === "K") { const a = u * u, b = 2 * s.w * u * t, c = t * t, d = a + b + c; return [(p0[0] * a + p1[0] * b + p2[0] * c) / d, (p0[1] * a + p1[1] * b + p2[1] * c) / d]; }
  return add(add(mul(p0, u * u * u), mul(p1, 3 * u * u * t)), add(mul(p2, 3 * u * t * t), mul(p3, t * t * t)));
}
// unit tangents at the start and the end, skipping control points that sit on the end point
function tangents(s) {
  const pts = s.p, n = pts.length - 1;
  let a = [0, 0], b = [0, 0];
  for (let i = 1; i <= n && len(a) < 1e-9; i++) a = sub(pts[i], pts[0]);
  for (let i = n - 1; i >= 0 && len(b) < 1e-9; i--) b = sub(pts[n], pts[i]);
  return [unit(a), unit(b)];
}
function segLength(s) {
  let L = 0, prev = s.p[0];
  for (let i = 1; i <= 16; i++) { const q = evalSeg(s, i / 16); L += len(sub(q, prev)); prev = q; }
  return L;
}

// Contours from CanvasKit's path commands (verbs 0 move, 1 line, 2 quad, 3 conic, 4 cubic, 5 close).
export function contoursOf(cmds) {
  const out = [];
  let cur = null, pt = null, i = 0;
  const pt2 = (j) => [cmds[j], cmds[j + 1]];
  while (i < cmds.length) {
    const v = cmds[i];
    if (v === 0) { cur = { start: pt2(i + 1), segs: [], closed: false }; out.push(cur); pt = cur.start; i += 3; }
    else if (v === 1) { const e = pt2(i + 1); if (len(sub(e, pt)) > 1e-9) cur.segs.push({ k: "L", p: [pt, e] }); pt = e; i += 3; }
    else if (v === 2) { const c = pt2(i + 1), e = pt2(i + 3); cur.segs.push({ k: "Q", p: [pt, c, e] }); pt = e; i += 5; }
    else if (v === 3) { const c = pt2(i + 1), e = pt2(i + 3); cur.segs.push({ k: "K", p: [pt, c, e], w: cmds[i + 5] }); pt = e; i += 6; }
    else if (v === 4) { const c1 = pt2(i + 1), c2 = pt2(i + 3), e = pt2(i + 5); cur.segs.push({ k: "C", p: [pt, c1, c2, e] }); pt = e; i += 7; }
    else if (v === 5) { if (len(sub(pt, cur.start)) > 1e-9) cur.segs.push({ k: "L", p: [pt, cur.start] }); cur.closed = true; pt = cur.start; i += 1; }
    else throw new Error("Unknown path verb " + v);
  }
  return out.filter((c) => c.segs.length);
}

// ---------- Schneider's curve fitting (Graphics Gems, 1990) ----------
const bez = (b, t) => { const u = 1 - t; return add(add(mul(b[0], u * u * u), mul(b[1], 3 * u * u * t)), add(mul(b[2], 3 * u * t * t), mul(b[3], t * t * t))); };
const bez1 = (b, t) => { const u = 1 - t; return add(add(mul(sub(b[1], b[0]), 3 * u * u), mul(sub(b[2], b[1]), 6 * u * t)), mul(sub(b[3], b[2]), 3 * t * t)); };
const bez2 = (b, t) => add(mul(add(sub(b[2], mul(b[1], 2)), b[0]), 6 * (1 - t)), mul(add(sub(b[3], mul(b[2], 2)), b[1]), 6 * t));
function generate(d, first, last, u, t1, t2) {
  const p0 = d[first], p3 = d[last];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i <= last - first; i++) {
    const t = u[i], s = 1 - t, b1 = 3 * t * s * s, b2 = 3 * t * t * s;
    const a1 = mul(t1, b1), a2 = mul(t2, b2);
    c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
    const tmp = sub(d[first + i], add(mul(p0, s * s * s + b1), mul(p3, b2 + t * t * t)));
    x0 += dot(a1, tmp); x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let al = det ? (x0 * c11 - x1 * c01) / det : 0, ar = det ? (c00 * x1 - c01 * x0) / det : 0;
  const seg = len(sub(p3, p0)), eps = 1e-6 * seg;
  if (al < eps || ar < eps) al = ar = seg / 3;
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
}
function maxError(d, first, last, b, u) {
  let mx = 0, at = Math.floor((last - first + 1) / 2) + first;
  for (let i = first + 1; i < last; i++) {
    const e = len(sub(bez(b, u[i - first]), d[i]));
    if (e > mx) { mx = e; at = i; }
  }
  return [mx, at];
}
function reparam(d, first, last, u, b) {
  return u.map((t, i) => {
    const p = d[first + i], q = sub(bez(b, t), p), q1 = bez1(b, t), q2 = bez2(b, t);
    const den = dot(q1, q1) + dot(q, q2);
    const nt = den ? t - dot(q, q1) / den : t;
    return Math.min(1, Math.max(0, nt));
  });
}
function fit(d, first, last, t1, t2, tol, out) {
  if (last - first === 1) { const s = len(sub(d[last], d[first])) / 3; out.push([d[first], add(d[first], mul(t1, s)), add(d[last], mul(t2, s)), d[last]]); return; }
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + len(sub(d[i], d[i - 1])));
  for (let i = 0; i < u.length; i++) u[i] /= u[u.length - 1];
  let b = generate(d, first, last, u, t1, t2), [e, at] = maxError(d, first, last, b, u), uu = u;
  if (e < tol) { out.push(b); return; }
  if (e < tol * 8) {
    for (let k = 0; k < 12; k++) {
      uu = reparam(d, first, last, uu, b);
      b = generate(d, first, last, uu, t1, t2);
      [e, at] = maxError(d, first, last, b, uu);
      if (e < tol) { out.push(b); return; }
    }
  }
  // split where the fit strays most, unless that is near an end (as on a round cap): then in the middle, so an
  // arc becomes two even halves rather than a sliver and a remainder that fails again
  const span = last - first;
  if (at - first < span * 0.3 || last - at < span * 0.3) at = first + Math.round(span / 2);
  const tc = unit(sub(d[at - 1], d[at + 1]));
  fit(d, first, at, t1, tc, tol, out);
  fit(d, at, last, mul(tc, -1), t2, tol, out);
}

// Distances to a polyline, with its segments bucketed on a grid so each query only looks nearby.
const CELL = 0.05;
function nearIndex(pts) {
  const grid = new Map(), key = (i, j) => i * 100003 + j;
  for (let n = 1; n < pts.length; n++) {
    const a = pts[n - 1], b = pts[n];
    for (let i = Math.floor(Math.min(a[0], b[0]) / CELL); i <= Math.floor(Math.max(a[0], b[0]) / CELL); i++)
      for (let j = Math.floor(Math.min(a[1], b[1]) / CELL); j <= Math.floor(Math.max(a[1], b[1]) / CELL); j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(n);
      }
  }
  // the distance from p to the polyline, or Infinity when it is more than a cell away
  return (p) => {
    let best = Infinity;
    const ci = Math.floor(p[0] / CELL), cj = Math.floor(p[1] / CELL);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      for (const n of grid.get(key(i, j)) || []) {
        const a = pts[n - 1], ab = sub(pts[n], a), l2 = dot(ab, ab);
        const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
        best = Math.min(best, len(sub(p, add(a, mul(ab, t)))));
      }
    }
    return best;
  };
}
// points along a curve no more than `step` apart
function samples(s, step) {
  const n = Math.max(6, Math.ceil(segLength(s) / step)), out = [];
  for (let j = 1; j <= n; j++) out.push(evalSeg(s, j / n));
  return out;
}
// Skia's round caps and joins are conic arcs of 90° at most; each is written as one cubic
function toCubic(s) {
  if (s.k !== "K") return s;
  const [p0, p1, p2] = s.p, k = (4 * s.w) / (3 * (1 + s.w));
  return { k: "C", p: [p0, add(p0, mul(sub(p1, p0), k)), add(p2, mul(sub(p1, p2), k)), p2] };
}

// A smooth curved run, densely sampled, refitted with cubics; it keeps its own pieces if no fit stays within TOL.
function refit(run) {
  const pts = [run[0].p[0]];
  for (const s of run) pts.push(...samples(s, 0.03));
  const near = nearIndex(pts);
  const t1 = tangents(run[0])[0], t2 = mul(tangents(run[run.length - 1])[1], -1);
  for (const tol of [TOL * 0.6, TOL * 0.3]) {
    const out = [];
    fit(pts, 0, pts.length - 1, t1, t2, tol, out);
    // check both ways: every refitted point near the exact run, and every exact point near the refit
    const fitted = [out[0][0]];
    for (const b of out) fitted.push(...samples({ k: "C", p: b }, 0.02));
    const back = nearIndex(fitted);
    if (fitted.every((q) => near(q) <= TOL) && pts.every((q) => back(q) <= TOL)) return out.map((b) => ({ k: "C", p: b }));
  }
  return run.map(toCubic);
}

const CORNER = Math.cos((8 * Math.PI) / 180); // tangents turning more than 8° make a corner
export function compactContours(contours) {
  return contours.map((c) => {
    let segs = c.segs;
    const n = segs.length, smoothAfter = (i) => { // the join from segs[i] to segs[i+1] is smooth (and both are curves)
      const a = segs[i], b = segs[(i + 1) % n];
      if (a.k === "L" || b.k === "L") return false;
      return dot(tangents(a)[1], tangents(b)[0]) > CORNER;
    };
    // a closed contour starts at a corner if it has one, so no run is split at the seam; one with no corner at
    // all (a ring of a single arc) is split in two halves, as a run that ends where it starts cannot be fitted
    const cut = new Set([n - 1]);
    if (c.closed) {
      const k = segs.findIndex((s, i) => !smoothAfter((i - 1 + n) % n));
      if (k > 0) segs = [...segs.slice(k), ...segs.slice(0, k)];
      if (k < 0) {
        let total = 0, acc = 0;
        const L = segs.map((s) => segLength(s));
        for (const l of L) total += l;
        for (let i = 0; i < n - 1; i++) { acc += L[i]; if (acc >= total / 2) { cut.add(i); break; } }
      }
    }
    const out = [];
    let run = [];
    const flush = () => { if (run.length) { out.push(...refit(run)); run = []; } };
    segs.forEach((s, i) => {
      if (s.k === "L") {
        flush();
        const last = out[out.length - 1];
        // collinear lines become one
        if (last && last.k === "L" && Math.abs(dot(unit(sub(last.p[1], last.p[0])), unit(sub(s.p[1], s.p[0]))) - 1) < 1e-9) last.p = [last.p[0], s.p[1]];
        else out.push(s);
        return;
      }
      run.push(s);
      const nextIsSmooth = !cut.has(i) && (() => { const b = segs[i + 1]; return b.k !== "L" && dot(tangents(s)[1], tangents(b)[0]) > CORNER; })();
      if (!nextIsSmooth) flush();
    });
    flush();
    return { start: out[0].p[0], segs: out, closed: c.closed };
  });
}

// ---------- Writing: rounded absolute points, written relative, numbers as short as they go ----------
const R = (v) => Math.round(v * 1000) / 1000;
function num(v) {
  let s = String(+v.toFixed(3));
  if (s === "-0") s = "0";
  return s.replace(/^0\./, ".").replace(/^-0\./, "-.");
}
export function writePath(contours) {
  let d = "", prevCmd = "", lastTok = "";
  const put = (cmd, nums) => {
    const strs = nums.map(num);
    if (cmd !== prevCmd || cmd === "m" || cmd === "M") { d += cmd; lastTok = cmd; }
    for (const s of strs) {
      const glue = /[a-zA-Z]$/.test(d) ? "" : s.startsWith("-") ? "" : s.startsWith(".") && /\.\d*$/.test(lastTok) ? "" : " ";
      d += glue + s;
      lastTok = s;
    }
    prevCmd = cmd === "m" ? "l" : cmd === "M" ? "L" : cmd;
  };
  let cur = [0, 0];
  for (const c of contours) {
    const s0 = [R(c.start[0]), R(c.start[1])];
    if (d === "") put("M", s0); else put("m", [R(s0[0] - cur[0]), R(s0[1] - cur[1])]);
    cur = s0;
    const segs = [...c.segs];
    // the closing line is drawn by z
    if (c.closed && segs.length > 1 && segs[segs.length - 1].k === "L") segs.pop();
    for (const seg of segs) {
      const s = toCubic(seg), pts = s.p.slice(1).map((q) => [R(q[0]), R(q[1])]);
      const e = pts[pts.length - 1];
      if (s.k === "L") {
        const dx = R(e[0] - cur[0]), dy = R(e[1] - cur[1]);
        if (dx === 0 && dy === 0) continue;
        if (dy === 0) put("h", [dx]); else if (dx === 0) put("v", [dy]); else put("l", [dx, dy]);
      } else if (s.k === "Q") put("q", pts.flatMap((q) => [R(q[0] - cur[0]), R(q[1] - cur[1])]));
      else put("c", pts.flatMap((q) => [R(q[0] - cur[0]), R(q[1] - cur[1])]));
      cur = e;
    }
    if (c.closed) { d += "z"; prevCmd = "z"; lastTok = "z"; cur = s0; }
  }
  return d;
}

// ---------- Checking: the furthest a compacted outline strays from the exact one (both ways) ----------
export function deviation(a, b) {
  const pa = [], pb = [];
  for (const c of a) { pa.push([c.segs[0].p[0]]); for (const s of c.segs) pa[pa.length - 1].push(...samples(s, 0.01)); }
  for (const c of b) { pb.push([c.segs[0].p[0]]); for (const s of c.segs) pb[pb.length - 1].push(...samples(toCubic(s), 0.01)); }
  let worst = 0;
  pa.forEach((A, i) => {
    const B = pb[i], nA = nearIndex(A), nB = nearIndex(B);
    for (const q of A) worst = Math.max(worst, nB(q));
    for (const q of B) worst = Math.max(worst, nA(q));
  });
  return worst;
}

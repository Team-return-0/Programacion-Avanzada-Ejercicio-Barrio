'use strict';
/* =====================================================================
   Elección del mejor barrio — visualizador
   Fuerza bruta (un Dijkstra por fuente)  vs  Greedy (Dijkstra multi-fuente)
   ===================================================================== */

const OFFSET = 1000;          // para que 1000 - v sea >= 0
const MAX_DRAW = 3600;        // máximo de esquinas que se dibujan
const MAX_EVENTS = 400000;    // máximo de pasos que se graban para animar
const MAX_BRUTE_WORK = 3e7;   // K * M * N máximo para correr la fuerza bruta de verdad

const PRESETS = {
  modificado: '10 8 3\n8 5 2\n1 7 0\n4 2 5\n4\n7 2 7 3\n9 5 10 5\n9 6 9 7\n8 5 8 6',
  original: '10 8 3\n8 5\n1 7\n4 2',
  nuevo: '6 5 1\n3 3 0\n0',
};

const PSEUDO = {
  brute: [
    'ALGORITMO BarrioFuerzaBruta(M, N, fuentes, cortes)',
    '  mejor ← matriz(M×N, +∞)',
    '  PARA CADA fuente (s, v) HACER',
    '    dist ← Dijkstra(s)       <c>// pesos 1 ⇒ BFS</c>',
    '    PARA CADA esquina c alcanzada HACER',
    '      mejor[c] ← min(mejor[c], dist[c] − v)',
    '  R ← max(mejor)',
    '  RETORNAR R, { c : mejor[c] = R }',
  ],
  greedy: [
    'ALGORITMO BarrioGreedy(M, N, fuentes, cortes)',
    '  dist ← matriz(M×N, +∞);  H ← heap vacío',
    '  PARA CADA fuente (s, v) HACER',
    '    dist[s] ← min(dist[s], 1000 − v);  H.push(s)',
    '  MIENTRAS H no está vacío HACER',
    '    u ← H.extraerMin()       <c>// elección greedy</c>',
    '    PARA CADA vecino w de u (cuadra abierta) HACER',
    '      SI dist[u] + 1 < dist[w] ENTONCES',
    '        dist[w] ← dist[u] + 1;  H.push(w)',
    '  R ← max(dist) − 1000',
    '  RETORNAR R, { c : dist[c] − 1000 = R }',
  ],
};
const PSEUDO_LINES = {
  brute: { init: [1], start: [2, 3], visit: [3, 4, 5], final: [6, 7] },
  greedy: { init: [1], src: [2, 3], settle: [5, 6, 7, 8], final: [9, 10] },
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------------------------- estado global ---------------------------- */
let P = null;                 // problema parseado
let RUN = { brute: null, greedy: null };
let mode = 'greedy';
let step = 0;                 // cantidad de eventos aplicados
let S = null;                 // estado de dibujo tras `step` eventos
let playing = false, timer = null;
let selected = -1;
let G = null;                 // referencias al SVG

/* ------------------------------ parseo --------------------------------- */
function parse(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
  let li = 0;
  const nums = (expectMin, expectMax, what) => {
    if (li >= lines.length) throw new Error(`Falta la línea de ${what}.`);
    const parts = lines[li].split(/\s+/);
    const arr = parts.map(Number);
    if (arr.some(n => !Number.isInteger(n))) throw new Error(`Línea ${li + 1}: se esperaban enteros (${what}).`);
    if (arr.length < expectMin || arr.length > expectMax)
      throw new Error(`Línea ${li + 1}: se esperaban ${expectMin === expectMax ? expectMin : expectMin + ' o ' + expectMax} números (${what}).`);
    li++;
    return arr;
  };
  const [M, N, K] = nums(3, 3, 'M N K');
  if (M < 1 || N < 1 || M > 1000 || N > 1000) throw new Error('M y N deben estar entre 1 y 1000.');
  if (K < 1 || K > 100000) throw new Error('K debe estar entre 1 y 100 000.');
  const V = M * N;
  const id = (x, y) => (y - 1) * M + (x - 1);
  const inside = (x, y) => x >= 1 && x <= M && y >= 1 && y <= N;

  const src = [];
  for (let i = 0; i < K; i++) {
    const [x, y, v = 0] = nums(2, 3, `la fuente ${i + 1}`);
    if (!inside(x, y)) throw new Error(`Fuente ${i + 1}: (${x}, ${y}) está fuera de la ciudad.`);
    if (v < 0 || v > 1000) throw new Error(`Fuente ${i + 1}: v debe estar entre 0 y 1000.`);
    src.push({ x, y, v, id: id(x, y) });
  }
  const cut = new Set();
  if (li < lines.length) {
    const [B] = nums(1, 1, 'B');
    for (let i = 0; i < B; i++) {
      const [x1, y1, x2, y2] = nums(4, 4, `la cuadra cortada ${i + 1}`);
      if (!inside(x1, y1) || !inside(x2, y2)) throw new Error(`Cuadra ${i + 1}: esquina fuera de la ciudad.`);
      if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) throw new Error(`Cuadra ${i + 1}: las esquinas no son vecinas.`);
      cut.add(ekey(id(x1, y1), id(x2, y2), V));
    }
  }
  if (li < lines.length) throw new Error(`Línea ${li + 1}: sobran datos.`);
  return { M, N, V, src, cut };
}

function ekey(a, b, V) { return a < b ? a * V + b : b * V + a; }
const X = u => (u % P.M) + 1;
const Y = u => Math.floor(u / P.M) + 1;
const fmt = u => `(${X(u)}, ${Y(u)})`;

function serialize(P) {
  const out = [`${P.M} ${P.N} ${P.src.length}`];
  for (const s of P.src) out.push(`${s.x} ${s.y} ${s.v}`);
  out.push(String(P.cut.size));
  for (const k of P.cut) {
    const a = Math.floor(k / P.V), b = k % P.V;
    out.push(`${X(a)} ${Y(a)} ${X(b)} ${Y(b)}`);
  }
  return out.join('\n');
}

/* recorre los vecinos de u con cuadra abierta: norte, sur, este, oeste */
function forNbrs(u, fn) {
  const { M, N, V, cut } = P;
  const x = u % M, y = (u - x) / M;
  if (y + 1 < N && !cut.has(ekey(u, u + M, V))) fn(u + M);
  if (y > 0 && !cut.has(ekey(u, u - M, V))) fn(u - M);
  if (x + 1 < M && !cut.has(ekey(u, u + 1, V))) fn(u + 1);
  if (x > 0 && !cut.has(ekey(u, u - 1, V))) fn(u - 1);
}

/* ------------------------------ heap ----------------------------------- */
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a; a.push(x);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p] <= x) break; a[i] = a[p]; i = p; }
    a[i] = x;
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop(), n = a.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; if (l >= n) break;
        const r = l + 1, m = (r < n && a[r] < a[l]) ? r : l;
        if (a[m] >= last) break;
        a[i] = a[m]; i = m;
      }
      a[i] = last;
    }
    return top;
  }
}

/* -------------------------- algoritmos --------------------------------- */
function finalize(val) {
  let max = -Infinity, unreachable = 0;
  for (let u = 0; u < P.V; u++) {
    if (!isFinite(val[u])) unreachable++;
    else if (val[u] > max) max = val[u];
  }
  const list = [];
  for (let u = 0; u < P.V; u++) if (val[u] === max) list.push(u);
  list.sort((a, b) => X(a) - X(b) || Y(a) - Y(b));   // orden: x y luego y
  return { max, list, unreachable, val };
}

/* 🔨 Fuerza bruta: un recorrido de Dijkstra por cada fuente (pesos 1 ⇒ BFS) */
function runBrute(record) {
  const V = P.V;
  const best = new Float64Array(V).fill(Infinity);
  const owner = new Int32Array(V).fill(-1);
  const dist = new Int32Array(V);
  const q = new Int32Array(V);
  const ev = record ? [] : null;
  let pops = 0, edges = 0;

  P.src.forEach((s, i) => {
    if (ev) ev.push({ t: 'start', i });
    dist.fill(-1);
    let h = 0, t = 0;
    dist[s.id] = 0; q[t++] = s.id;
    while (h < t) {
      const u = q[h++]; pops++;
      const m = dist[u] - s.v;
      const old = best[u];
      const imp = m < old;
      if (imp) { best[u] = m; owner[u] = i; }
      if (ev) ev.push({ t: 'visit', i, u, d: dist[u], m, imp, old });
      forNbrs(u, w => { edges++; if (dist[w] < 0) { dist[w] = dist[u] + 1; q[t++] = w; } });
    }
  });
  if (ev) ev.push({ t: 'final' });
  return { events: ev, res: finalize(best), owner, counts: { pops, edges, pushes: pops, stale: 0 } };
}

/* ⚡ Greedy: Dijkstra multi-fuente desde una súper-fuente (dist inicial 1000 − v) */
function runGreedy(record) {
  const V = P.V;
  const dist = new Float64Array(V).fill(Infinity);
  const owner = new Int32Array(V).fill(-1);
  const parent = new Int32Array(V).fill(-1);
  const done = new Uint8Array(V);
  const H = new MinHeap();
  const ev = record ? [] : null;
  let pops = 0, edges = 0, pushes = 0, stale = 0;

  P.src.forEach((s, i) => {
    const key = OFFSET - s.v;
    const acc = key < dist[s.id];
    if (acc) { dist[s.id] = key; owner[s.id] = i; H.push(key * V + s.id); pushes++; }
    if (ev) ev.push({ t: 'src', i, u: s.id, key, acc });
  });

  while (H.size) {
    const k = H.pop(), u = k % V, d = (k - u) / V;
    if (done[u] || d > dist[u]) { stale++; continue; }   // entrada vieja del heap
    done[u] = 1; pops++;
    const rel = ev ? [] : null;
    forNbrs(u, w => {
      edges++;
      if (!done[w] && d + 1 < dist[w]) {
        if (rel) rel.push(w);
        dist[w] = d + 1; owner[w] = owner[u]; parent[w] = u;
        H.push((d + 1) * V + w); pushes++;
      }
    });
    if (ev) ev.push({ t: 'settle', u, d, rel });
  }
  if (ev) ev.push({ t: 'final' });
  const val = dist.map(x => x - OFFSET);
  return { events: ev, res: finalize(val), owner, parent, counts: { pops, edges, pushes, stale } };
}

/* distancias de cada fuente a una esquina (para explicar un clic en fuerza bruta) */
function perSourceTo(target) {
  const V = P.V, dist = new Int32Array(V), q = new Int32Array(V);
  return P.src.map((s, i) => {
    dist.fill(-1);
    let h = 0, t = 0; dist[s.id] = 0; q[t++] = s.id;
    while (h < t && dist[target] < 0) {
      const u = q[h++];
      forNbrs(u, w => { if (dist[w] < 0) { dist[w] = dist[u] + 1; q[t++] = w; } });
    }
    const d = dist[target];
    return { i, d, m: d < 0 ? Infinity : d - s.v };
  });
}

/* ------------------------ estado de reproducción ----------------------- */
function freshState() {
  return {
    val: new Float64Array(P.V).fill(Infinity),
    owner: new Int32Array(P.V).fill(-1),
    done: new Uint8Array(P.V),
    mark: new Int32Array(P.V).fill(-1),
    curSrc: -1, cur: -1, rel: [], final: false, ev: null,
  };
}

function apply(st, e) {
  st.ev = e; st.cur = -1; st.rel = [];
  switch (e.t) {
    case 'start': st.curSrc = e.i; break;
    case 'visit':
      st.cur = e.u; st.mark[e.u] = e.i;
      if (e.imp) { st.val[e.u] = e.m; st.owner[e.u] = e.i; }
      break;
    case 'src':
      st.cur = e.u;
      if (e.acc) { st.val[e.u] = e.key - OFFSET; st.owner[e.u] = e.i; }
      break;
    case 'settle':
      st.cur = e.u; st.done[e.u] = 1; st.rel = e.rel;
      for (const w of e.rel) { st.val[w] = e.d + 1 - OFFSET; st.owner[w] = st.owner[e.u]; }
      break;
    case 'final': st.final = true; st.curSrc = -1; break;
  }
}

function events() { return RUN[mode].events; }
function totalSteps() { const ev = events(); return ev ? ev.length : 0; }

function goTo(k) {
  const ev = events();
  if (!ev) { S = null; step = 0; render(); return; }
  k = Math.max(0, Math.min(ev.length, k));
  if (!S || k < step) { S = freshState(); step = 0; }
  while (step < k) apply(S, ev[step++]);
  render();
}

/* ------------------------------- SVG ----------------------------------- */
const hue = i => (i * 137.508 + 200) % 360;

function buildSvg() {
  const wrap = $('#gridWrap');
  if (P.V > MAX_DRAW) {
    G = null;
    wrap.innerHTML = `<div class="msg">La ciudad tiene ${P.V.toLocaleString('es')} esquinas: es demasiado grande para dibujarla.<br>Se calculan igual los resultados y la comparación.</div>`;
    return;
  }
  const { M, N, V } = P;
  const avail = Math.max(320, wrap.clientWidth - 8);
  const cell = Math.max(16, Math.min(58, Math.floor((avail - 36) / M)));
  const L = 30, T = 10;
  const W = L + cell * M + 6, Hh = T + cell * N + 22;
  const cx = x => L + cell * x + cell / 2;          // x en base 0
  const cy = y => T + cell * (N - 1 - y) + cell / 2; // y en base 0, norte arriba
  const ns = cell * 0.74, fs = Math.max(9, cell * 0.3);
  const showText = cell >= 22;

  let streets = '', nodes = '', axes = '', badges = '';
  const seg = (a, b) => {
    const ax = a % M, ay = (a - ax) / M, bx = b % M, by = (b - bx) / M;
    const k = ekey(a, b, V);
    streets += `<line class="hit" data-e="${k}" x1="${cx(ax)}" y1="${cy(ay)}" x2="${cx(bx)}" y2="${cy(by)}"><title>Cuadra (${ax + 1},${ay + 1})–(${bx + 1},${by + 1}): clic para cortar/abrir</title></line>`;
    streets += `<line class="street" data-s="${k}" x1="${cx(ax)}" y1="${cy(ay)}" x2="${cx(bx)}" y2="${cy(by)}"/>`;
  };
  for (let u = 0; u < V; u++) {
    const x = u % M, y = (u - x) / M;
    if (x + 1 < M) seg(u, u + 1);
    if (y + 1 < N) seg(u, u + M);
  }
  // marcas ✕ en cuadras cortadas
  let cuts = '';
  for (const k of P.cut) {
    const a = Math.floor(k / V), b = k % V;
    const mx = (cx(a % M) + cx(b % M)) / 2, my = (cy(Math.floor(a / M)) + cy(Math.floor(b / M))) / 2, r = Math.max(3, cell * 0.1);
    cuts += `<path class="cutx" d="M${mx - r},${my - r}L${mx + r},${my + r}M${mx + r},${my - r}L${mx - r},${my + r}"/>`;
  }
  for (let u = 0; u < V; u++) {
    const x = u % M, y = (u - x) / M;
    nodes += `<g class="node" data-u="${u}"><rect x="${cx(x) - ns / 2}" y="${cy(y) - ns / 2}" width="${ns}" height="${ns}" rx="${ns * 0.18}"/>` +
      (showText ? `<text x="${cx(x)}" y="${cy(y)}" font-size="${fs}"></text>` : '') +
      `<title>Esquina (${x + 1}, ${y + 1})</title></g>`;
  }
  const seenSrc = new Set();
  P.src.forEach((s, i) => {
    if (seenSrc.has(s.id)) return; seenSrc.add(s.id);
    const r = Math.max(6, cell * 0.17);
    const bx = cx(s.x - 1) + ns / 2 - r * 0.4, by = cy(s.y - 1) - ns / 2 + r * 0.4;
    badges += `<g class="badge-v"><circle cx="${bx}" cy="${by}" r="${r}" fill="hsl(${hue(i)} 70% 40%)"/><text x="${bx}" y="${by}" font-size="${Math.max(8, r * 1.05)}">${s.v}</text><title>Fuente ${i + 1}: v = ${s.v}</title></g>`;
  });
  const step = M > 30 ? 5 : 1;
  for (let x = 0; x < M; x++) if ((x + 1) % step === 0 || x === 0) axes += `<text class="axis" x="${cx(x)}" y="${T + cell * N + 15}">${x + 1}</text>`;
  for (let y = 0; y < N; y++) if ((y + 1) % step === 0 || y === 0) axes += `<text class="axis" x="${L - 14}" y="${cy(y) + 4}">${y + 1}</text>`;

  wrap.innerHTML = `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${streets}${cuts}${nodes}${badges}${axes}<text class="axis" x="${W - 8}" y="${Hh - 2}" text-anchor="end">x →</text><text class="axis" x="10" y="${T + 6}">y↑</text></svg>`;

  G = {
    nodes: $$('#gridWrap .node'),
    rects: $$('#gridWrap .node rect'),
    texts: showText ? $$('#gridWrap .node text') : null,
    streets: new Map($$('#gridWrap .street').map(el => [Number(el.dataset.s), el])),
  };
  for (const [k, el] of G.streets) if (P.cut.has(k)) el.classList.add('cut');
}

function nodeFill(st, u, range) {
  if (!isFinite(st.val[u])) return '';
  const tentative = mode === 'greedy' && !st.done[u];
  if ($('#colorMode').value === 'heat') {
    const t = range.hi === range.lo ? 1 : (st.val[u] - range.lo) / (range.hi - range.lo);
    return `hsl(${Math.round(t * 130)} 65% ${tentative ? 30 : 40}% / ${tentative ? 0.55 : 1})`;
  }
  const o = st.owner[u];
  return `hsl(${hue(o)} 60% ${tentative ? 28 : 38}% / ${tentative ? 0.55 : 1})`;
}

function paintGrid() {
  if (!G) return;
  const st = S || freshState();
  const res = RUN[mode].res;
  const srcSet = new Set(P.src.map(s => s.id));
  const relSet = new Set(st.rel);
  const maxSet = st.final ? new Set(res.list) : new Set();
  let lo = Infinity, hi = -Infinity;
  for (let u = 0; u < P.V; u++) if (isFinite(st.val[u])) { lo = Math.min(lo, st.val[u]); hi = Math.max(hi, st.val[u]); }
  const range = { lo, hi };
  const pathSet = selected >= 0 && st.final ? pathEdges(selected) : new Set();

  for (let u = 0; u < P.V; u++) {
    const g = G.nodes[u], v = st.val[u], fin = isFinite(v);
    const tent = mode === 'greedy' && fin && !st.done[u];
    const cls = ['node'];
    if (!fin) cls.push('unk');
    if (tent) cls.push('tent');
    if (mode === 'brute' && st.curSrc >= 0 && st.mark[u] === st.curSrc) cls.push('pass');
    if (srcSet.has(u)) cls.push('src');
    if (relSet.has(u)) cls.push('rel');
    if (maxSet.has(u)) cls.push('max');
    if (u === st.cur) cls.push('cur');
    if (u === selected) cls.push('sel');
    g.setAttribute('class', cls.join(' '));
    G.rects[u].style.fill = nodeFill(st, u, range);
    if (G.texts) G.texts[u].textContent = fin ? v : '∞';
  }
  for (const [k, el] of G.streets) el.classList.toggle('path', pathSet.has(k));
}

/* aristas del camino más corto (greedy) desde la esquina hasta su fuente */
function pathEdges(u) {
  const set = new Set(), par = RUN.greedy.parent;
  let guard = 0;
  while (par[u] >= 0 && guard++ < P.V) { set.add(ekey(u, par[u], P.V)); u = par[u]; }
  return set;
}

/* ------------------------------ render --------------------------------- */
function render() {
  const n = totalSteps();
  const animated = !!events();
  $('#stepInfo').textContent = animated ? `Paso ${step} de ${n}` : 'Sin animación (entrada grande)';
  const scrub = $('#scrub');
  scrub.max = n; scrub.value = step; scrub.disabled = !animated;
  ['#btnFirst', '#btnPrev', '#btnPlay', '#btnNext', '#btnLast'].forEach(s => $(s).disabled = !animated);
  $('#btnPlay').textContent = playing ? '⏸' : '▶';
  $('#modeBrute').classList.toggle('active', mode === 'brute');
  $('#modeGreedy').classList.toggle('active', mode === 'greedy');

  paintGrid();
  renderPseudo();
  renderResult();
  renderExplain();
}

function renderPseudo() {
  const e = S && S.ev;
  const hl = new Set(e ? PSEUDO_LINES[mode][e.t] : (step === 0 ? PSEUDO_LINES[mode].init : []));
  $('#pseudoTitle').textContent = mode === 'brute' ? '· fuerza bruta' : '· greedy';
  $('#pseudo').innerHTML = PSEUDO[mode].map((l, i) => {
    const html = escapeHtml(l).replace(/&lt;c&gt;(.*?)&lt;\/c&gt;/g, '<span class="cm">$1</span>');
    return `<span class="ln${hl.has(i) ? ' hl' : ''}">${html}</span>`;
  }).join('');
}

function renderResult() {
  const run = RUN[mode];
  const known = !events() || (S && S.final);
  if (!known) {
    $('#resMax').innerHTML = '<span class="text-body-secondary fs-6 fw-normal">Se conoce al terminar el recorrido</span>';
    $('#resList').innerHTML = `<button class="btn btn-sm btn-outline-success" id="goEnd">Ir al resultado ⏭</button>`;
    $('#goEnd').onclick = () => { stop(); goTo(totalSteps()); };
    $('#resOut').textContent = '…';
    return;
  }
  const r = run.res;
  $('#resMax').textContent = r.max;
  const shown = r.list.slice(0, 12).map(fmt).join(' ');
  $('#resList').textContent = `${r.list.length} → ${shown}${r.list.length > 12 ? ' …' : ''}`;
  const out = [r.max, r.list.length, ...r.list.slice(0, 200).map(u => `${X(u)} ${Y(u)}`)];
  if (r.list.length > 200) out.push('…');
  $('#resOut').textContent = out.join('\n');
}

function renderExplain() {
  const box = $('#explain');
  if (selected >= 0) { box.innerHTML = explainNode(selected); return; }
  const e = S && S.ev;
  if (!events()) {
    box.innerHTML = '<div class="step-box">La entrada es muy grande para animarla paso a paso. Mirá el resultado y la tabla de comparación.</div>';
    return;
  }
  box.innerHTML = `<div class="step-box">${e ? explainEvent(e) : explainStart()}</div>
    <div class="small text-body-secondary mt-2">Paso ${step} de ${totalSteps()} · Hacé clic en una esquina para ver cómo se calculó su valor.</div>`;
}

function srcLabel(i) {
  const s = P.src[i];
  return `<span style="color:hsl(${hue(i)} 70% 60%)">■</span> fuente ${i + 1} (${s.x}, ${s.y}) con v = ${s.v}`;
}

function explainStart() {
  return mode === 'brute'
    ? '🔨 <b>Fuerza bruta.</b> Todas las esquinas arrancan con <code>mejor = ∞</code>. Se va a correr un Dijkstra completo desde <b>cada</b> una de las ' + P.src.length + ' fuentes, y en cada esquina nos quedamos con la menor molestia vista.'
    : '⚡ <b>Greedy.</b> Todas las esquinas arrancan con <code>dist = ∞</code>. Se cargan <b>todas</b> las fuentes juntas en el heap con distancia <code>1000 − v</code>, como si colgaran de una súper-fuente, y se corre <b>un solo</b> Dijkstra.';
}

function explainEvent(e) {
  switch (e.t) {
    case 'start':
      return `🚩 Comienza la pasada ${e.i + 1} de ${P.src.length}: ${srcLabel(e.i)}. Se corre un Dijkstra desde esta esquina (con cuadras de peso 1 es un BFS).`;
    case 'visit': {
      const s = P.src[e.i];
      const prev = isFinite(e.old) ? e.old : '∞';
      return `Pasada ${e.i + 1}: la esquina <b>${fmt(e.u)}</b> está a <b>${e.d}</b> cuadra(s) de la fuente ${e.i + 1}. ` +
        `Molestia = ${e.d} − ${s.v} = <b>${e.m}</b>. ` +
        (e.imp ? `Es menor que el mínimo anterior (${prev}) ⇒ <code>mejor${fmt(e.u)} = ${e.m}</code>.`
               : `No mejora el mínimo actual (${prev}); queda igual.`);
    }
    case 'src':
      return e.acc
        ? `📥 ${srcLabel(e.i)} entra al heap con <code>dist = 1000 − ${P.src[e.i].v} = ${e.key}</code> (molestia ${e.key - OFFSET}). Cuanto más intensa la fuente, antes “arranca”.`
        : `📥 ${srcLabel(e.i)}: en esa esquina ya hay una fuente con menor distancia inicial; esta no aporta nada.`;
    case 'settle': {
      const rel = e.rel.length ? `Se relajan ${e.rel.map(fmt).join(', ')} con <code>dist = ${e.d + 1}</code> (molestia ${e.d + 1 - OFFSET}).` : 'Ningún vecino mejora (ya estaban fijados o tenían una distancia menor o igual).';
      return `⛏️ Se extrae del heap <b>${fmt(e.u)}</b>, la esquina con menor distancia tentativa: <code>${e.d}</code> ⇒ molestia <b>${e.d - OFFSET}</b>. ` +
        `<b>Elección greedy:</b> queda fija porque todas las cuadras pesan 1 ≥ 0, así que nada que aparezca después puede mejorarla. ${rel}`;
    }
    case 'final': {
      const r = RUN[mode].res;
      const extra = r.unreachable ? ` ⚠️ ${r.unreachable} esquina(s) no son alcanzables y se ignoran.` : '';
      return `🏁 Terminado. La máxima molestia mínima es <b>${r.max}</b> y la alcanzan <b>${r.list.length}</b> esquina(s): ${r.list.slice(0, 20).map(fmt).join(', ')}${r.list.length > 20 ? '…' : ''}.${extra}`;
    }
  }
  return '';
}

function explainNode(u) {
  const head = `<div class="d-flex justify-content-between align-items-center mb-2"><b>Esquina ${fmt(u)}</b><button class="btn btn-sm btn-outline-secondary" id="closeSel">✕ volver a los pasos</button></div>`;
  const fin = RUN[mode].res.val[u];
  let body = '';
  if (mode === 'brute' || P.src.length <= 30) {
    if (P.src.length * P.V > 5e6) {
      body = `<p>Valor final: <b>${fin}</b>.</p>`;
    } else {
      const rows = perSourceTo(u).sort((a, b) => a.m - b.m);
      const best = rows[0];
      body = `<p class="mb-1">Molestia de cada fuente sobre esta esquina (distancia sin cuadras cortadas − v):</p>
        <table class="table table-sm w-auto mb-2"><thead><tr><th>Fuente</th><th>dist</th><th>− v</th><th>molestia</th></tr></thead><tbody>` +
        rows.slice(0, 12).map(r => `<tr class="${r === best ? 'table-success' : ''}"><td>${srcLabel(r.i)}</td><td>${r.d < 0 ? '∞' : r.d}</td><td>${P.src[r.i].v}</td><td><b>${isFinite(r.m) ? r.m : '∞'}</b></td></tr>`).join('') +
        `</tbody></table>${rows.length > 12 ? `<div class="small text-body-secondary">… y ${rows.length - 12} fuentes más.</div>` : ''}
        <p class="mb-0">Valor de la esquina = <b>mínimo</b> de esa columna = <b>${isFinite(fin) ? fin : '∞'}</b>.</p>`;
    }
  }
  if (mode === 'greedy') {
    const steps = pathEdges(u).size;
    const o = RUN.greedy.owner[u];
    body += `<p class="mt-2 mb-0">En el greedy, esta esquina se fijó con <code>dist = ${isFinite(fin) ? fin + OFFSET : '∞'}</code>` +
      (o >= 0 ? `, llegando desde ${srcLabel(o)} por un camino de ${steps} cuadra(s) (resaltado en verde al final del recorrido): ${1000 - P.src[o].v} + ${steps} − 1000 = ${fin}.` : '.') + '</p>';
  }
  const res = RUN[mode].res;
  if (res.list.includes(u)) body += '<p class="mt-2 mb-0">⭐ Es una de las esquinas óptimas.</p>';
  setTimeout(() => { const b = $('#closeSel'); if (b) b.onclick = () => { selected = -1; render(); }; });
  return head + body;
}

/* --------------------------- comparación ------------------------------- */
function renderCompare() {
  const b = RUN.brute, g = RUN.greedy;
  const K = P.src.length, V = P.V;
  const fmtN = n => n == null ? '—' : Math.round(n).toLocaleString('es');
  const bOps = b ? b.counts.pops + b.counts.edges : null;
  const gOps = g.counts.pops + g.counts.edges + g.counts.stale;
  const row = (name, bv, gv, lowerWins = true) => {
    const bw = bv != null && (lowerWins ? bv < gv : bv > gv), gw = bv != null && (lowerWins ? gv < bv : gv > bv);
    return `<tr><td>${name}</td><td class="${bw ? 'win' : ''}">${fmtN(bv)}</td><td class="${gw ? 'win' : ''}">${fmtN(gv)}</td></tr>`;
  };
  $('#cmpBody').innerHTML =
    row('Recorridos de la grilla', b ? K : null, 1) +
    row('Esquinas procesadas', b ? b.counts.pops : null, g.counts.pops) +
    row('Cuadras examinadas', b ? b.counts.edges : null, g.counts.edges) +
    row('Operaciones totales', bOps, gOps) +
    `<tr><td>Complejidad</td><td>O(K·M·N)</td><td>O(M·N·log(M·N))</td></tr>` +
    `<tr><td>Peor caso (M=N=1000, K=10⁵)</td><td>≈ 10¹¹</td><td>≈ 2·10⁷</td></tr>`;
  const ratio = b ? (bOps / gOps) : null;
  $('#cmpNote').innerHTML = b
    ? `Con esta entrada la fuerza bruta hace <b>${ratio.toFixed(1)}×</b> el trabajo del greedy; la diferencia crece linealmente con K. Ambas dan el mismo resultado: ${b.res.max === g.res.max && b.res.list.length === g.res.list.length ? '✅ coinciden' : '❌ NO coinciden'}.`
    : `La fuerza bruta no se ejecutó: haría unas ${fmtN(K * V)} visitas de esquinas.`;
}

/* --------------------------- aplicar entrada --------------------------- */
function applyInput(keepStep) {
  stop();
  let parsed;
  try { parsed = parse($('#input').value); }
  catch (err) {
    $('#inputError').textContent = err.message;
    $('#inputError').classList.remove('d-none');
    return false;
  }
  $('#inputError').classList.add('d-none');
  P = parsed;
  selected = -1;
  const K = P.src.length;
  const draw = P.V <= MAX_DRAW;
  RUN.greedy = runGreedy(draw && K + P.V + 1 <= MAX_EVENTS);
  RUN.brute = K * P.V <= MAX_BRUTE_WORK ? runBrute(draw && K * P.V + K + 1 <= MAX_EVENTS) : null;
  if (!RUN.brute && mode === 'brute') mode = 'greedy';
  $('#modeBrute').disabled = !RUN.brute;
  buildSvg();
  renderCompare();
  S = null; step = 0;
  goTo(keepStep ? totalSteps() : 0);
  return true;
}

/* edición directa sobre la grilla */
function onGridClick(ev) {
  const hit = ev.target.closest('.hit');
  if (hit) {
    const k = Number(hit.dataset.e);
    if (P.cut.has(k)) P.cut.delete(k); else P.cut.add(k);
    $('#input').value = serialize(P);
    applyInput(true);
    return;
  }
  const node = ev.target.closest('.node');
  if (!node) return;
  const u = Number(node.dataset.u);
  if (ev.shiftKey) {
    const idx = P.src.findIndex(s => s.id === u);
    if (idx >= 0) {
      if (P.src.length === 1) return;
      P.src = P.src.filter(s => s.id !== u);
    } else {
      const v = Math.max(0, Math.min(1000, parseInt($('#newV').value, 10) || 0));
      P.src.push({ x: X(u), y: Y(u), v, id: u });
    }
    $('#input').value = serialize(P);
    applyInput(true);
    return;
  }
  selected = selected === u ? -1 : u;
  render();
}

/* ----------------------------- reproducción ---------------------------- */
function delay() {
  const s = Number($('#speed').value);        // 0..100
  return Math.round(900 * Math.pow(0.93, s)); // ~900ms … ~0.6ms
}
function tick() {
  if (!playing) return;
  if (step >= totalSteps()) { stop(); return; }
  const d = delay();
  const per = d < 16 ? Math.ceil(16 / Math.max(d, 0.5)) : 1;  // varios pasos por cuadro si es muy rápido
  goTo(step + per);
  timer = setTimeout(tick, Math.max(d, 16));
}
function play() {
  if (step >= totalSteps()) goTo(0);
  playing = true; selected = -1; render(); tick();
}
function stop() { playing = false; clearTimeout(timer); if ($('#btnPlay')) $('#btnPlay').textContent = '▶'; }

/* ------------------------------ utilidades ----------------------------- */
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function randomInput() {
  const M = 8 + Math.floor(Math.random() * 7), N = 6 + Math.floor(Math.random() * 5);
  const K = 2 + Math.floor(Math.random() * 3);
  const lines = [`${M} ${N} ${K}`];
  for (let i = 0; i < K; i++) lines.push(`${1 + Math.floor(Math.random() * M)} ${1 + Math.floor(Math.random() * N)} ${Math.floor(Math.random() * 6)}`);
  const B = 4 + Math.floor(Math.random() * 8), seen = new Set(), cuts = [];
  while (cuts.length < B) {
    const x = 1 + Math.floor(Math.random() * M), y = 1 + Math.floor(Math.random() * N);
    const hor = Math.random() < 0.5;
    const x2 = hor ? x + 1 : x, y2 = hor ? y : y + 1;
    if (x2 > M || y2 > N) continue;
    const k = `${x},${y},${x2},${y2}`;
    if (seen.has(k)) continue;
    seen.add(k); cuts.push(`${x} ${y} ${x2} ${y2}`);
  }
  lines.push(String(B), ...cuts);
  return lines.join('\n');
}

function setTheme(t) {
  document.documentElement.dataset.bsTheme = t;
  $('#btnTheme').textContent = t === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('barrio-theme', t); } catch (_) {}
}

/* -------------------------------- init --------------------------------- */
function init() {
  let theme = 'dark';
  try { theme = localStorage.getItem('barrio-theme') || 'dark'; } catch (_) {}
  setTheme(theme);

  let initial = PRESETS.modificado;
  if (location.hash.startsWith('#in=')) {
    try { initial = decodeURIComponent(location.hash.slice(4)); } catch (_) {}
  }
  $('#input').value = initial;

  $('#btnApply').onclick = () => applyInput(false);
  $$('[data-preset]').forEach(b => b.onclick = () => {
    $('#input').value = b.dataset.preset === 'random' ? randomInput() : PRESETS[b.dataset.preset];
    applyInput(false);
  });
  $$('[data-mode]').forEach(b => b.onclick = () => {
    stop(); mode = b.dataset.mode; selected = -1; S = null; step = 0; goTo(0);
  });
  $('#btnFirst').onclick = () => { stop(); goTo(0); };
  $('#btnPrev').onclick = () => { stop(); goTo(step - 1); };
  $('#btnNext').onclick = () => { stop(); goTo(step + 1); };
  $('#btnLast').onclick = () => { stop(); goTo(totalSteps()); };
  $('#btnPlay').onclick = () => playing ? (stop(), render()) : play();
  $('#scrub').oninput = e => { stop(); goTo(Number(e.target.value)); };
  $('#colorMode').onchange = () => paintGrid();
  $('#gridWrap').addEventListener('click', onGridClick);
  $('#btnTheme').onclick = () => setTheme(document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark');

  let confirmNew = false;
  $('#btnNew').onclick = () => {
    if (!confirmNew) {
      confirmNew = true; $('#btnNew').textContent = '¿Seguro?';
      setTimeout(() => { confirmNew = false; $('#btnNew').textContent = '🆕 Nuevo'; }, 2500);
      return;
    }
    confirmNew = false; $('#btnNew').textContent = '🆕 Nuevo';
    $('#input').value = PRESETS.nuevo; applyInput(false);
  };
  $('#btnShare').onclick = async () => {
    const url = location.href.split('#')[0] + '#in=' + encodeURIComponent($('#input').value.trim());
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); $('#btnShare').textContent = '✅ Copiado'; }
    catch (_) { $('#btnShare').textContent = '🔗 En la URL'; }
    setTimeout(() => $('#btnShare').textContent = '🔗 Compartir', 1800);
  };

  document.addEventListener('keydown', e => {
    if (e.target.matches('textarea, input')) return;
    if (e.key === 'ArrowRight') { stop(); goTo(step + 1); }
    else if (e.key === 'ArrowLeft') { stop(); goTo(step - 1); }
    else if (e.key === ' ') { e.preventDefault(); playing ? (stop(), render()) : play(); }
  });

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (P) { buildSvg(); paintGrid(); } }, 150); });

  applyInput(false);
}

init();

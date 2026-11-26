'use strict';
/* =====================================================================
   Elección del mejor barrio — visualizador
   🔨 Fuerza bruta: un BFS por cada tumultuosa
   ⚡ Dijkstra (multi-fuente), con valor inicial −v
   ===================================================================== */

const MAX_DRAW = 3600;        // máximo de esquinas que se dibujan
const MAX_EVENTS = 500000;    // máximo de pasos que se graban para animar
const MAX_BRUTE_WORK = 3e7;   // K · M · N máximo para correr la fuerza bruta de verdad
const MAX_ROWS = 150;         // máximo de filas editables en el formulario
const MAX_TABLE_COLS = 40;    // máximo de columnas en la vista tabla

/* ------------------------- casos predefinidos -------------------------- */
const PRESETS = [
  { id: 'concreto', name: 'Ejemplo acotado (Bestiario)',
    text: '5 4 2\n1 1 0\n4 4 2\n2\n3 2 4 2\n3 4 4 4',
    desc: 'Ciudad de 5 × 4, A = (1, 1) con v = 0 y B = (4, 4) con v = 2, dos cuadras cortadas. Resultado esperado: 3 en (1, 4).' },
  { id: 'original', name: 'Ejemplo del enunciado original',
    text: '10 8 3\n8 5 0\n1 7 0\n4 2 0\n0',
    desc: 'Sin cortes ni intensidades (todas v = 0). Resultado esperado: 6 en (10, 1).' },
  { id: 'modificado', name: 'Ejemplo del enunciado modificado',
    text: '10 8 3\n8 5 2\n1 7 0\n4 2 5\n4\n7 2 7 3\n9 5 10 5\n9 6 9 7\n8 5 8 6',
    desc: 'Con cortes e intensidades. Resultado esperado: 4 en (9, 8).' },
  { id: 'una', name: 'Una sola tumultuosa (K = 1)',
    text: '7 5 1\n4 3 0\n0',
    desc: 'Mejor caso de la fuerza bruta: es un único BFS y no necesita heap.' },
  { id: 'empate', name: 'Empate: varias esquinas óptimas',
    text: '5 5 1\n3 3 0\n0',
    desc: 'Las cuatro puntas quedan a la misma distancia: prueba el conteo y el orden de la salida.' },
  { id: 'muro', name: 'Muro de cuadras cortadas',
    text: '9 6 2\n3 3 0\n8 1 1\n5\n5 1 6 1\n5 2 6 2\n5 3 6 3\n5 4 6 4\n5 5 6 5',
    desc: 'Un muro obliga a rodear por arriba: la distancia ya no es la distancia Manhattan.' },
  { id: 'intensa', name: 'Tumultuosa lejana pero intensa',
    text: '9 5 2\n2 3 0\n8 3 6\n0',
    desc: 'La de la derecha (v = 6) molesta más esquinas que la de la izquierda aunque esté más lejos.' },
  { id: 'grande', name: 'Grande: 150 × 150, K = 400 (sin animación)',
    gen: { M: 150, N: 150, K: 400, vmax: 50, B: 3000, seed: 7 },
    desc: 'Demasiado grande para animar: sirve para comparar cuánto trabaja cada técnica.' },
];

/* ------------------------------ código --------------------------------- */
const VECINOS = [
  'funcion VECINOS(x, y, M, N, cortes):',
  '    resultado <- lista vacia',
  '    para cada (nx, ny) en {(x+1, y), (x-1, y), (x, y+1), (x, y-1)}:',
  '        si 1 <= nx <= M  y  1 <= ny <= N  y  {(x, y), (nx, ny)} no esta en cortes:',
  '            agregar (nx, ny) a resultado',
  '    devolver resultado',
  '',
];
const CODE = {
  brute: [
    ...VECINOS,
    'funcion BFS(origen, M, N, cortes):',
    '    dist <- diccionario vacio',
    '    dist[origen] <- 0',
    '    cola <- cola con [origen]',
    '    mientras cola no vacia:',
    '        u <- desencolar(cola)',
    '        para cada w en VECINOS(u, M, N, cortes):',
    '            si w no esta en dist:',
    '                dist[w] <- dist[u] + 1',
    '                encolar(cola, w)',
    '    devolver dist',
    '',
    'funcion MEJOR_BARRIO_FUERZA_BRUTA(M, N, tumultuosas, cortes):',
    '    molestia <- diccionario vacio                // cada esquina arranca en +infinito',
    '',
    '    para cada (x, y, v) en tumultuosas:          // K recorridos completos',
    '        dist <- BFS((x, y), M, N, cortes)',
    '        para cada esquina c en dist:',
    '            molestia[c] <- min(molestia[c], dist[c] - v)',
    '',
    '    maximo <- max de los valores de molestia',
    '    ganadoras <- esquinas c con molestia[c] = maximo, ordenadas por (x, y)',
    '    devolver maximo, ganadoras',
  ],
  greedy: [
    ...VECINOS,
    'funcion MEJOR_BARRIO_DIJKSTRA(M, N, tumultuosas, cortes):',
    '    molestia <- diccionario vacio                // esquinas ya fijadas',
    '    heap <- heap de MINIMOS vacio',
    '',
    '    para cada (x, y, v) en tumultuosas:          // todos los origenes a la vez',
    '        insertar (-v, (x, y)) en heap',
    '',
    '    mientras heap no vacio:',
    '        (m, u) <- extraer minimo de heap',
    '        si u esta en molestia:                   // copia repetida, ya fijada',
    '            continuar',
    '        molestia[u] <- m                         // valor definitivo',
    '        para cada w en VECINOS(u, M, N, cortes):',
    '            si w no esta en molestia:',
    '                insertar (m + 1, w) en heap',
    '',
    '    maximo <- max de los valores de molestia',
    '    ganadoras <- esquinas c con molestia[c] = maximo, ordenadas por (x, y)',
    '    devolver maximo, ganadoras',
  ],
};
/* líneas (base 0) que se resaltan en cada tipo de paso */
const CODE_LINES = {
  brute: { init: [19, 20], start: [22, 23, 7, 8, 9, 10], visit: [11, 12, 13, 14, 15, 16], upd: [24, 25], final: [27, 28, 29] },
  greedy: { init: [7, 8, 9], src: [11, 12], settle: [14, 15, 18, 19, 20, 21], stale: [14, 15, 16, 17], final: [23, 24, 25] },
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------------------------- estado global ---------------------------- */
let model = null;             // caso de prueba: { M, N, src: [{x,y,v}], cuts: [{x,y,dir}] }
let P = null;                 // problema listo para los algoritmos
let RUN = { brute: null, greedy: null };
let mode = 'brute';
let step = 0;                 // cantidad de eventos aplicados
let S = null;                 // estado de dibujo tras `step` eventos
let playing = false, timer = null;
let selected = -1;
let G = null;                 // referencias al SVG

/* --------------------- modelo  ⇄  texto barrio.in ---------------------- */
function parseText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
  let li = 0;
  const nums = (min, max, what) => {
    if (li >= lines.length) throw new Error(`Falta la línea de ${what}.`);
    const arr = lines[li].split(/\s+/).map(Number);
    if (arr.some(n => !Number.isInteger(n))) throw new Error(`Línea ${li + 1}: se esperaban enteros (${what}).`);
    if (arr.length < min || arr.length > max)
      throw new Error(`Línea ${li + 1}: se esperaban ${min === max ? min : min + ' o ' + max} números (${what}).`);
    li++;
    return arr;
  };
  const [M, N, K] = nums(3, 3, 'M N K');
  const src = [];
  for (let i = 0; i < K; i++) {
    const [x, y, v = 0] = nums(2, 3, `la tumultuosa ${i + 1}`);
    src.push({ x, y, v });
  }
  const cuts = [];
  if (li < lines.length) {
    const [B] = nums(1, 1, 'B');
    for (let i = 0; i < B; i++) {
      const [x1, y1, x2, y2] = nums(4, 4, `la cuadra cortada ${i + 1}`);
      if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) throw new Error(`Cuadra ${i + 1}: (${x1}, ${y1}) y (${x2}, ${y2}) no son vecinas.`);
      cuts.push(y1 === y2 ? { x: Math.min(x1, x2), y: y1, dir: 'E' } : { x: x1, y: Math.min(y1, y2), dir: 'N' });
    }
  }
  if (li < lines.length) throw new Error(`Línea ${li + 1}: sobran datos.`);
  return { M, N, src, cuts };
}

function serialize(m) {
  const out = [`${m.M} ${m.N} ${m.src.length}`];
  for (const s of m.src) out.push(`${s.x} ${s.y} ${s.v}`);
  out.push(String(m.cuts.length));
  for (const c of m.cuts) out.push(c.dir === 'E' ? `${c.x} ${c.y} ${c.x + 1} ${c.y}` : `${c.x} ${c.y} ${c.x} ${c.y + 1}`);
  return out.join('\n');
}

const cutLabel = c => c.dir === 'E' ? `(${c.x}, ${c.y})–(${c.x + 1}, ${c.y})` : `(${c.x}, ${c.y})–(${c.x}, ${c.y + 1})`;

/* valida el modelo y arma la estructura que usan los algoritmos */
function buildProblem(m) {
  const fail = (msg, sel) => { const e = new Error(msg); e.sel = sel; throw e; };
  const okInt = n => Number.isInteger(n);
  if (!okInt(m.M) || m.M < 1 || m.M > 1000) fail('El ancho M debe ser un entero entre 1 y 1000.', '#fM');
  if (!okInt(m.N) || m.N < 1 || m.N > 1000) fail('El alto N debe ser un entero entre 1 y 1000.', '#fN');
  if (m.src.length < 1) fail('Tiene que haber al menos una esquina tumultuosa.');
  if (m.src.length > 100000) fail('K no puede superar 100 000.');
  const { M, N } = m, V = M * N;
  const id = (x, y) => (y - 1) * M + (x - 1);
  const inside = (x, y) => okInt(x) && okInt(y) && x >= 1 && x <= M && y >= 1 && y <= N;
  const src = m.src.map((s, i) => {
    if (!inside(s.x, s.y)) fail(`Tumultuosa ${i + 1}: (${s.x}, ${s.y}) queda fuera de la ciudad de ${M} × ${N}.`, `[data-src="${i}"][data-k="x"]`);
    if (!okInt(s.v) || s.v < 0 || s.v > 1000) fail(`Tumultuosa ${i + 1}: el nivel v debe estar entre 0 y 1000.`, `[data-src="${i}"][data-k="v"]`);
    return { ...s, id: id(s.x, s.y) };
  });
  const cut = new Set();
  m.cuts.forEach((c, i) => {
    const x2 = c.dir === 'E' ? c.x + 1 : c.x, y2 = c.dir === 'E' ? c.y : c.y + 1;
    if (!inside(c.x, c.y) || !inside(x2, y2)) fail(`Cuadra cortada ${i + 1}: ${cutLabel(c)} queda fuera de la ciudad.`, `[data-cut="${i}"][data-k="x"]`);
    const k = ekey(id(c.x, c.y), id(x2, y2), V);
    if (cut.has(k)) fail(`Cuadra cortada ${i + 1}: ${cutLabel(c)} está repetida.`, `[data-cut="${i}"][data-k="x"]`);
    cut.add(k);
  });
  return { M, N, V, src, cut };
}

function ekey(a, b, V) { return a < b ? a * V + b : b * V + a; }
const X = u => (u % P.M) + 1;
const Y = u => Math.floor(u / P.M) + 1;
const fmt = u => `(${X(u)}, ${Y(u)})`;

/* vecinos con cuadra abierta, en el mismo orden que el código: este, oeste, norte, sur */
function forNbrs(u, fn) {
  const { M, N, V, cut } = P;
  const x = u % M, y = (u - x) / M;
  if (x + 1 < M && !cut.has(ekey(u, u + 1, V))) fn(u + 1);
  if (x > 0 && !cut.has(ekey(u, u - 1, V))) fn(u - 1);
  if (y + 1 < N && !cut.has(ekey(u, u + M, V))) fn(u + M);
  if (y > 0 && !cut.has(ekey(u, u - M, V))) fn(u - M);
}

/* ------------------------------ heap ----------------------------------- */
/* entradas [molestia, x, y, id]: se comparan como la tupla (m, (x, y)) de Python */
const less = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a; a.push(x);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!less(x, a[p])) break; a[i] = a[p]; i = p; }
    a[i] = x;
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop(), n = a.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; if (l >= n) break;
        const r = l + 1, m = (r < n && less(a[r], a[l])) ? r : l;
        if (!less(a[m], last)) break;
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
  list.sort((a, b) => X(a) - X(b) || Y(a) - Y(b));   // sorted(): por x y luego por y
  return { max, list, unreachable, val };
}

/* 🔨 Fuerza bruta: un BFS completo por cada tumultuosa */
function runBrute(record) {
  const V = P.V;
  const molestia = new Float64Array(V).fill(Infinity);
  const owner = new Int32Array(V).fill(-1);
  const dist = new Int32Array(V);
  const cola = new Int32Array(V);
  const ev = record ? [] : null;
  let visits = 0, edges = 0, updates = 0;

  P.src.forEach((s, i) => {
    if (ev) ev.push({ t: 'start', i });
    // bfs(origen)
    dist.fill(-1);
    let h = 0, t = 0;
    dist[s.id] = 0; cola[t++] = s.id;
    while (h < t) {
      const u = cola[h++]; visits++;
      const add = ev ? [] : null;
      forNbrs(u, w => {
        edges++;
        if (dist[w] < 0) { dist[w] = dist[u] + 1; cola[t++] = w; if (add) add.push(w); }
      });
      if (ev) ev.push({ t: 'visit', i, u, d: dist[u], add });
    }
    // for esquina, d in dist.items(): molestia = min(molestia, d - v)
    for (let j = 0; j < t; j++) {
      const u = cola[j]; updates++;
      const m = dist[u] - s.v, old = molestia[u], imp = m < old;
      if (imp) { molestia[u] = m; owner[u] = i; }
      if (ev) ev.push({ t: 'upd', i, u, d: dist[u], m, imp, old });
    }
  });
  if (ev) ev.push({ t: 'final' });
  return { events: ev, res: finalize(molestia), owner, counts: { visits, edges, writes: updates, stale: 0 } };
}

/* ⚡ Dijkstra (multi-fuente). Cada tumultuosa entra al heap con −v;
   una esquina recibe su molestia recién cuando sale del heap por primera vez. */
function runGreedy(record) {
  const V = P.V;
  const molestia = new Float64Array(V).fill(Infinity);   // solo esquinas fijadas
  const owner = new Int32Array(V).fill(-1);
  const parent = new Int32Array(V).fill(-1);
  const fijada = new Uint8Array(V);
  const heap = new MinHeap();
  const ev = record ? [] : null;
  let visits = 0, edges = 0, pushes = 0, stale = 0;

  // entradas: [m, x, y, id, tumultuosa de origen, esquina desde la que se insertó]
  P.src.forEach((s, i) => {
    heap.push([-s.v, s.x, s.y, s.id, i, -1]); pushes++;
    if (ev) ev.push({ t: 'src', i, u: s.id });
  });

  while (heap.size) {
    const [m, , , u, o, par] = heap.pop();
    if (fijada[u]) { stale++; if (ev) ev.push({ t: 'stale', u, m }); continue; }
    fijada[u] = 1; molestia[u] = m; owner[u] = o; parent[u] = par; visits++;
    const ins = ev ? [] : null;
    forNbrs(u, w => {
      edges++;
      if (!fijada[w]) {
        heap.push([m + 1, X(w), Y(w), w, o, u]); pushes++;
        if (ins) ins.push(w);
      }
    });
    if (ev) ev.push({ t: 'settle', u, m, o, ins });
  }
  if (ev) ev.push({ t: 'final' });
  return { events: ev, res: finalize(molestia), owner, parent, counts: { visits, edges, writes: pushes, stale } };
}

/* distancia de cada tumultuosa a una esquina (para explicar un clic) */
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
    disc: [], head: 0, phase: '',   // cola del BFS de la pasada actual
    cnt: new Int32Array(P.V), heapSize: 0,   // copias de cada esquina en el heap (Dijkstra)
  };
}

function apply(st, e) {
  st.ev = e; st.cur = -1; st.rel = [];
  switch (e.t) {
    case 'start':
      st.curSrc = e.i; st.phase = 'bfs'; st.head = 0;
      st.disc = [[P.src[e.i].id, 0]]; st.mark[P.src[e.i].id] = e.i;
      break;
    case 'visit':
      st.cur = e.u; st.head++; st.rel = e.add;
      for (const w of e.add) { st.disc.push([w, e.d + 1]); st.mark[w] = e.i; }
      break;
    case 'upd':
      st.cur = e.u; st.phase = 'upd';
      if (e.imp) { st.val[e.u] = e.m; st.owner[e.u] = e.i; }
      break;
    /* en Dijkstra, val de una esquina no fijada = menor valor con el que está en el heap */
    case 'src': {
      const m = -P.src[e.i].v;
      st.cur = e.u; st.cnt[e.u]++; st.heapSize++;
      if (m < st.val[e.u]) { st.val[e.u] = m; st.owner[e.u] = e.i; }
      break;
    }
    case 'settle':
      st.cur = e.u; st.done[e.u] = 1; st.rel = e.ins;
      st.cnt[e.u]--; st.heapSize--;
      st.val[e.u] = e.m; st.owner[e.u] = e.o;
      for (const w of e.ins) {
        st.cnt[w]++; st.heapSize++;
        if (e.m + 1 < st.val[w]) { st.val[w] = e.m + 1; st.owner[w] = e.o; }
      }
      break;
    case 'stale': st.cur = e.u; st.cnt[e.u]--; st.heapSize--; break;
    case 'final': st.final = true; st.curSrc = -1; st.phase = ''; break;
  }
}

function events() { return RUN[mode] ? RUN[mode].events : null; }
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
    wrap.innerHTML = `<div class="msg">La ciudad tiene ${P.V.toLocaleString('es')} esquinas: es demasiado grande para dibujarla.<br>Igual se calculan el resultado y la comparación.</div>`;
    return;
  }
  const { M, N, V } = P;
  const avail = Math.max(300, wrap.clientWidth - 8);
  // la grilla ocupa todo el ancho disponible, sin pasarse de ~62 % del alto de la ventana
  const byW = Math.floor((avail - 36) / M), byH = Math.floor((window.innerHeight * 0.62) / N);
  const cell = Math.max(16, Math.min(110, byW, Math.max(byH, 28)));
  const L = 30, T = 10;
  const W = L + cell * M + 6, Hh = T + cell * N + 22;
  const cx = x => L + cell * x + cell / 2;          // x en base 0
  const cy = y => T + cell * (N - 1 - y) + cell / 2; // y en base 0, norte arriba
  const ns = cell * 0.74, fs = Math.max(9, cell * 0.3);
  const showText = cell >= 22;

  let streets = '', nodes = '', axes = '', badges = '', cuts = '';
  const seg = (a, b) => {
    const ax = a % M, ay = (a - ax) / M, bx = b % M, by = (b - bx) / M;
    const k = ekey(a, b, V);
    streets += `<line class="hit" data-e="${k}" x1="${cx(ax)}" y1="${cy(ay)}" x2="${cx(bx)}" y2="${cy(by)}"><title>Cuadra (${ax + 1}, ${ay + 1})–(${bx + 1}, ${by + 1}): clic para cortar/abrir</title></line>`;
    streets += `<line class="street" data-s="${k}" x1="${cx(ax)}" y1="${cy(ay)}" x2="${cx(bx)}" y2="${cy(by)}"/>`;
  };
  for (let u = 0; u < V; u++) {
    const x = u % M, y = (u - x) / M;
    if (x + 1 < M) seg(u, u + 1);
    if (y + 1 < N) seg(u, u + M);
  }
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
  const seen = new Set();
  P.src.forEach((s, i) => {
    if (seen.has(s.id)) return; seen.add(s.id);
    const r = Math.max(6, cell * 0.17);
    const bx = cx(s.x - 1) + ns / 2 - r * 0.4, by = cy(s.y - 1) - ns / 2 + r * 0.4;
    badges += `<g class="badge-v"><circle cx="${bx}" cy="${by}" r="${r}" fill="hsl(${hue(i)} 70% 40%)"/><text x="${bx}" y="${by}" font-size="${Math.max(8, r * 1.05)}">${s.v}</text><title>Tumultuosa ${i + 1}: v = ${s.v}</title></g>`;
  });
  const every = M > 30 || N > 30 ? 5 : 1;
  for (let x = 0; x < M; x++) if ((x + 1) % every === 0 || x === 0) axes += `<text class="axis" x="${cx(x)}" y="${T + cell * N + 15}">${x + 1}</text>`;
  for (let y = 0; y < N; y++) if ((y + 1) % every === 0 || y === 0) axes += `<text class="axis" x="${L - 14}" y="${cy(y) + 4}">${y + 1}</text>`;

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
  return `hsl(${hue(st.owner[u])} 60% ${tentative ? 28 : 38}% / ${tentative ? 0.55 : 1})`;
}

function paintGrid() {
  if (!G || $('#viewMode').value !== 'grid') return;
  const st = S || freshState();
  const res = RUN[mode].res;
  const srcSet = new Set(P.src.map(s => s.id));
  const relSet = new Set(st.rel);
  const maxSet = st.final ? new Set(res.list) : new Set();
  let lo = Infinity, hi = -Infinity;
  for (let u = 0; u < P.V; u++) if (isFinite(st.val[u])) { lo = Math.min(lo, st.val[u]); hi = Math.max(hi, st.val[u]); }
  const range = { lo, hi };
  const pathSet = selected >= 0 && st.final && mode === 'greedy' ? pathEdges(selected) : new Set();

  for (let u = 0; u < P.V; u++) {
    const v = st.val[u], fin = isFinite(v);
    const cls = ['node'];
    if (!fin) cls.push('unk');
    if (mode === 'greedy' && fin && !st.done[u]) cls.push('tent');
    if (mode === 'brute' && st.curSrc >= 0 && st.mark[u] === st.curSrc) cls.push('pass');
    if (srcSet.has(u)) cls.push('src');
    if (relSet.has(u)) cls.push('rel');
    if (maxSet.has(u)) cls.push('max');
    if (u === st.cur) cls.push('cur');
    if (u === selected) cls.push('sel');
    G.nodes[u].setAttribute('class', cls.join(' '));
    G.rects[u].style.fill = nodeFill(st, u, range);
    if (G.texts) G.texts[u].textContent = fin ? v : '∞';
  }
  for (const [k, el] of G.streets) el.classList.toggle('path', pathSet.has(k));
}

/* tabla de molestias con el mismo formato que la traza del Bestiario */
function renderTable() {
  const wrap = $('#tableWrap');
  if ($('#viewMode').value !== 'table') return;
  if (P.M > MAX_TABLE_COLS || P.N > 200) {
    wrap.innerHTML = `<div class="text-center text-body-secondary p-3">La tabla se muestra hasta ${MAX_TABLE_COLS} columnas.</div>`;
    return;
  }
  const st = S || freshState();
  const maxSet = st.final ? new Set(RUN[mode].res.list) : new Set();
  const srcSet = new Set(P.src.map(s => s.id));
  let h = '<table class="mtable"><thead><tr><th>y \\ x</th>';
  for (let x = 1; x <= P.M; x++) h += `<th>${x}</th>`;
  h += '</tr></thead><tbody>';
  for (let y = P.N; y >= 1; y--) {
    h += `<tr><th>${y}</th>`;
    for (let x = 1; x <= P.M; x++) {
      const u = (y - 1) * P.M + (x - 1), v = st.val[u];
      const cls = [];
      if (!isFinite(v)) cls.push('unk');
      else if (mode === 'greedy' && !st.done[u]) cls.push('tent');
      if (u === st.cur) cls.push('cur');
      if (maxSet.has(u)) cls.push('max');
      if (srcSet.has(u)) cls.push('src');
      h += `<td class="${cls.join(' ')}">${isFinite(v) ? String(v).replace('-', '−') : '∞'}</td>`;
    }
    h += '</tr>';
  }
  wrap.innerHTML = h + '</tbody></table><div class="small text-body-secondary text-center mt-1">Valores de <code>molestia</code> en este paso (subrayadas: tumultuosas; en itálica: todavía en el heap).</div>';
}

/* aristas del camino (Dijkstra) desde la esquina hasta su tumultuosa */
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
  $('#stepInfo').textContent = animated ? `Paso ${step} de ${n}` : 'Sin animación (caso grande)';
  const scrub = $('#scrub');
  scrub.max = n; scrub.value = step; scrub.disabled = !animated;
  ['#btnFirst', '#btnPrev', '#btnPlay', '#btnNext', '#btnLast'].forEach(s => $(s).disabled = !animated);
  $('#btnPlay').textContent = playing ? '⏸' : '▶';
  $('#modeBrute').classList.toggle('active', mode === 'brute');
  $('#modeGreedy').classList.toggle('active', mode === 'greedy');

  paintGrid();
  renderTable();
  renderCode();
  renderResult();
  renderExplain();
  renderQueue();
}

function highlightPseudo(line) {
  const c = line.indexOf('//');
  const code = c >= 0 ? line.slice(0, c) : line;
  const cm = c >= 0 ? line.slice(c) : '';
  const kw = escapeHtml(code).replace(/\b(funcion|para cada|mientras|si|devolver|continuar)\b/g, '<span class="kw">$1</span>');
  return kw + (cm ? `<span class="cm">${escapeHtml(cm)}</span>` : '');
}

function renderCode() {
  const e = S && S.ev;
  const hl = new Set(e ? CODE_LINES[mode][e.t] : (step === 0 ? CODE_LINES[mode].init : []));
  $('#codeTitle').textContent = mode === 'brute' ? '· fuerza bruta' : '· Dijkstra (multi-fuente)';
  $('#code').innerHTML = CODE[mode].map((l, i) =>
    `<span class="ln${hl.has(i) ? ' hl' : ''}"><span class="no">${i + 1}</span>${highlightPseudo(l)}</span>`).join('');
}

function renderResult() {
  const run = RUN[mode];
  const known = !events() || (S && S.final);
  if (!known) {
    $('#resMax').innerHTML = '<span class="text-body-secondary fs-6 fw-normal">Se conoce al terminar el recorrido</span>';
    $('#resList').innerHTML = '<button class="btn btn-sm btn-outline-success" id="goEnd">Ir al resultado ⏭</button>';
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

function renderQueue() {
  const box = $('#queue');
  $('#queueTitle').textContent = mode === 'brute' ? '📋 Cola del BFS (por niveles)' : '⛰️ Heap (entradas vigentes)';
  if (!events()) { box.innerHTML = '<span class="text-body-secondary">Sin animación para este caso.</span>'; return; }
  const st = S || freshState();

  if (mode === 'brute') {
    if (st.curSrc < 0) {
      box.innerHTML = `<span class="text-body-secondary">${st.final ? 'Terminaron los ' + P.src.length + ' BFS.' : 'Todavía no empezó ningún BFS.'}</span>`;
      return;
    }
    const s = P.src[st.curSrc];
    const levels = new Map();
    st.disc.forEach(([u, d], idx) => {
      if (!levels.has(d)) levels.set(d, []);
      const cls = u === st.cur ? 'now' : idx < st.head ? 'done' : 'pend';
      levels.get(d).push(`<span class="chip ${cls}">${fmt(u)}</span>`);
    });
    let h = `<div class="mb-1">BFS ${st.curSrc + 1} de ${P.src.length}, desde (${s.x}, ${s.y}).` +
      (st.phase === 'upd' ? ' <b>Terminó:</b> ahora se recorre <code>dist</code> y se actualiza la molestia.' : ` En cola: <b>${st.disc.length - st.head}</b>.`) + '</div>';
    h += '<table class="table table-sm"><thead><tr><th>Distancia</th><th>Esquinas que entran a la cola</th></tr></thead><tbody>';
    let shown = 0;
    for (const [d, chips] of levels) {
      if (shown > 400) { h += '<tr><td colspan="2">…</td></tr>'; break; }
      h += `<tr><td class="text-center">${d}</td><td>${chips.join('')}</td></tr>`;
      shown += chips.length;
    }
    box.innerHTML = h + '</tbody></table><div class="text-body-secondary">Azul: se está procesando · borde amarillo: espera en la cola · tenue: ya salió.</div>';
    return;
  }

  const live = [];
  let fixed = 0, staleCopies = 0;
  for (let u = 0; u < P.V; u++) {
    if (st.done[u]) { fixed++; staleCopies += st.cnt[u]; }
    else if (st.cnt[u] > 0) live.push(u);
  }
  live.sort((a, b) => st.val[a] - st.val[b] || X(a) - X(b) || Y(a) - Y(b));
  const chips = live.slice(0, 80).map(u =>
    `<span class="chip pend">(${String(st.val[u]).replace('-', '−')}, ${fmt(u)})${st.cnt[u] > 1 ? ` ×${st.cnt[u]}` : ''}</span>`).join('');
  box.innerHTML = `<div class="mb-1">Fijadas: <b>${fixed}</b> de ${P.V} · entradas en el heap: <b>${st.heapSize}</b></div>` +
    (st.heapSize ? `<div>${chips}${live.length > 80 ? ` … y ${live.length - 80} esquinas más` : ''}</div>
      ${staleCopies ? `<div class="mt-1">+ <b>${staleCopies}</b> copia(s) de esquinas ya fijadas: se descartan al salir.</div>` : ''}
      <div class="text-body-secondary mt-1">Esquinas no fijadas, ordenadas por <code>(m, (x, y))</code> con su menor valor en el heap; ×n indica cuántas copias tiene.</div>`
      : '<span class="text-body-secondary">El heap está vacío.</span>') +
    greedyTrace();
  const tr = $('#traceScroll');
  if (tr) tr.scrollTop = tr.scrollHeight;
}

/* traza con el mismo formato que la del Bestiario: Paso | Sale del heap | Acción | Entran al heap */
function greedyTrace() {
  const ev = events(), K = P.src.length;
  if (step < K) return '';
  const val = m => String(m).replace('-', '−');
  const srcName = u => {
    const i = P.src.findIndex(s => s.id === u);
    return i < 0 ? '' : ` la tumultuosa ${i + 1}`;
  };
  const cutNbrs = u => {
    const out = [], x = u % P.M, y = (u - x) / P.M;
    const test = (ok, w) => { if (ok && P.cut.has(ekey(u, w, P.V))) out.push(w); };
    test(x + 1 < P.M, u + 1); test(x > 0, u - 1); test(y + 1 < P.N, u + P.M); test(y > 0, u - P.M);
    return out;
  };
  const initial = [...P.src].sort((a, b) => b.v - a.v || a.x - b.x || a.y - b.y)
    .map(s => `(${val(-s.v)}, (${s.x}, ${s.y}))`).join(' y ');
  const rows = [];
  let n = 0;
  for (let j = K; j < step; j++) {
    const e = ev[j], now = j === step - 1 ? ' class="table-primary"' : '';
    if (e.t === 'settle') {
      n++;
      const cuts = cutNbrs(e.u).map(w => `${fmt(w)} no, la cuadra está cortada.`).join(' ');
      const ins = e.ins.length ? `${e.ins.map(fmt).join(', ')} con ${val(e.m + 1)}.` : '—';
      rows.push(`<tr${now}><td class="text-center">${n}</td><td>${fmt(e.u)} con ${val(e.m)}</td><td>Se fija${srcName(e.u)}</td><td>${ins} ${cuts}</td></tr>`);
    } else if (e.t === 'stale') {
      rows.push(`<tr${now}><td class="text-center">—</td><td>${fmt(e.u)} con ${val(e.m)}</td><td>Copia repetida: se descarta</td><td>—</td></tr>`);
    }
  }
  const shown = rows.length > 300 ? ['<tr><td colspan="4" class="text-center">…</td></tr>', ...rows.slice(-300)] : rows;
  return `<hr class="my-2"><div class="fw-semibold mb-1">Traza</div>
    <div class="mb-1">Heap inicial: <code>${initial.length > 300 ? initial.slice(0, 300) + '…' : initial}</code></div>
    ${rows.length ? `<div id="traceScroll" class="trace-scroll"><table class="table table-sm"><thead><tr><th>Paso</th><th>Sale del heap</th><th>Acción</th><th>Entran al heap</th></tr></thead><tbody>${shown.join('')}</tbody></table></div>` : ''}`;
}

function renderExplain() {
  const box = $('#explain');
  if (selected >= 0) { box.innerHTML = explainNode(selected); return; }
  if (!events()) {
    box.innerHTML = '<div class="step-box">El caso es muy grande para animarlo paso a paso. Mirá el resultado y la tabla de comparación.</div>';
    return;
  }
  const e = S && S.ev;
  box.innerHTML = `<div class="step-box">${e ? explainEvent(e) : explainStart()}</div>
    <div class="small text-body-secondary mt-2">Paso ${step} de ${totalSteps()} · Hacé clic en una esquina para ver cómo se calculó su valor.</div>`;
}

function srcLabel(i) {
  const s = P.src[i];
  return `<span style="color:hsl(${hue(i)} 70% 60%)">■</span> tumultuosa ${i + 1} (${s.x}, ${s.y}) con v = ${s.v}`;
}

function explainStart() {
  return mode === 'brute'
    ? `🔨 <b>Fuerza bruta.</b> <code>molestia</code> arranca vacío (todas las esquinas en ∞). Para cada una de las ${P.src.length} tumultuosas se hace un BFS completo y después se actualiza <code>molestia[esquina] = min(actual, d − v)</code>.`
    : `⚡ <b>Dijkstra (multi-fuente).</b> <code>molestia</code> arranca vacío y guarda solo las esquinas ya fijadas. Se insertan <b>todas</b> las tumultuosas en un heap de mínimos con valor <code>−v</code> y se hace <b>un solo</b> recorrido.`;
}

function explainEvent(e) {
  const r = RUN[mode].res;
  switch (e.t) {
    case 'start':
      return `🚩 Empieza el BFS ${e.i + 1} de ${P.src.length}: ${srcLabel(e.i)}. <code>dist = {origen: 0}</code> y la cola arranca con el origen.`;
    case 'visit':
      return `<code>u = cola.popleft()</code> → <b>${fmt(e.u)}</b>, a distancia ${e.d}. ` +
        (e.add.length ? `Vecinos nuevos (todavía no están en <code>dist</code>): ${e.add.map(fmt).join(', ')} → entran a la cola con distancia ${e.d + 1}.`
                      : 'Ningún vecino nuevo: los demás ya estaban en <code>dist</code>, quedan fuera de la ciudad o están del otro lado de una cuadra cortada.');
    case 'upd': {
      const s = P.src[e.i];
      const prev = isFinite(e.old) ? String(e.old) : '∞';
      return `Actualización tras el BFS ${e.i + 1}: <b>${fmt(e.u)}</b> está a d = ${e.d}, así que esta tumultuosa aporta ${e.d} − ${s.v} = <b>${e.m}</b>. ` +
        `<code>min(${prev}, ${e.m})</code> = <b>${e.imp ? e.m : prev}</b>` + (e.imp ? ' → se actualiza.' : ' → queda igual.');
    }
    case 'src':
      return `📥 ${srcLabel(e.i)}: <code>insertar (−${P.src[e.i].v}, (${P.src[e.i].x}, ${P.src[e.i].y})) en heap</code>. Todos los orígenes entran a la vez; cuanto más intensa la tumultuosa, antes “arranca”.`;
    case 'settle':
      return `⛏️ <code>extraer minimo</code> → <b>(${e.m}, ${fmt(e.u)})</b>. La esquina no estaba en <code>molestia</code>, así que <code>molestia${fmt(e.u)} ← ${e.m}</code>. ` +
        `<b>Elección de Dijkstra:</b> es definitiva, porque siempre sale el menor valor y cada cuadra suma 1: ninguna copia que salga después puede ser menor. ` +
        (e.ins.length ? `Se insertan con <code>${e.m} + 1 = ${e.m + 1}</code> los vecinos todavía no fijados: ${e.ins.map(fmt).join(', ')}.` : 'Todos sus vecinos ya estaban fijados: no se inserta nada.');
    case 'stale':
      return `🗑️ <code>extraer minimo</code> → (${e.m}, ${fmt(e.u)}), pero esa esquina <b>ya está en molestia</b>, fijada con un valor menor o igual: es una copia repetida (entró una vez por cada vecina que la alcanzó). Se descarta (<code>continuar</code>).`;
    case 'final': {
      const extra = r.unreachable ? ` ⚠️ ${r.unreachable} esquina(s) no son alcanzables y se ignoran.` : '';
      return `🏁 Terminado. <code>maximo = ${r.max}</code> y lo alcanzan <b>${r.list.length}</b> esquina(s): ${r.list.slice(0, 20).map(fmt).join(', ')}${r.list.length > 20 ? '…' : ''}.${extra}`;
    }
  }
  return '';
}

function explainNode(u) {
  const head = `<div class="d-flex justify-content-between align-items-center mb-2"><b>Esquina ${fmt(u)}</b><button class="btn btn-sm btn-outline-secondary" id="closeSel">✕ volver a los pasos</button></div>`;
  const fin = RUN[mode].res.val[u];
  let body = '';
  if (P.src.length * P.V > 5e6) {
    body = `<p>Valor final: <b>${fin}</b>.</p>`;
  } else {
    const rows = perSourceTo(u).sort((a, b) => a.m - b.m);
    const best = rows[0];
    body = `<p class="mb-1">Lo que aporta cada tumultuosa (distancia sin cuadras cortadas − v):</p>
      <table class="table table-sm w-auto mb-2"><thead><tr><th>Tumultuosa</th><th>d</th><th>v</th><th>d − v</th></tr></thead><tbody>` +
      rows.slice(0, 12).map(r => `<tr class="${r === best ? 'table-success' : ''}"><td>${srcLabel(r.i)}</td><td>${r.d < 0 ? '∞' : r.d}</td><td>${P.src[r.i].v}</td><td><b>${isFinite(r.m) ? r.m : '∞'}</b></td></tr>`).join('') +
      `</tbody></table>${rows.length > 12 ? `<div class="small text-body-secondary">… y ${rows.length - 12} más.</div>` : ''}
      <p class="mb-0"><code>molestia${fmt(u)}</code> = <b>mínimo</b> de la última columna = <b>${isFinite(fin) ? fin : '∞'}</b>.</p>`;
  }
  if (mode === 'greedy' && isFinite(fin)) {
    const o = RUN.greedy.owner[u], steps = pathEdges(u).size;
    body += `<p class="mt-2 mb-0">Con Dijkstra llega desde ${srcLabel(o)}: −${P.src[o].v} + ${steps} cuadra(s) = ${fin}. Al final del recorrido el camino se marca en verde.</p>`;
  }
  if (RUN[mode].res.list.includes(u)) body += '<p class="mt-2 mb-0">⭐ Es una de las esquinas óptimas.</p>';
  setTimeout(() => { const b = $('#closeSel'); if (b) b.onclick = () => { selected = -1; render(); }; });
  return head + body;
}

/* --------------------------- comparación ------------------------------- */
function renderCompare() {
  const b = RUN.brute, g = RUN.greedy;
  const K = P.src.length;
  const fmtN = n => n == null ? '—' : Math.round(n).toLocaleString('es');
  const bOps = b ? b.counts.visits + b.counts.edges + b.counts.writes : null;
  const gOps = g.counts.visits + g.counts.edges + g.counts.writes + g.counts.stale;
  const row = (name, bv, gv) => {
    const bw = bv != null && bv < gv, gw = bv != null && gv < bv;
    return `<tr><td>${name}</td><td class="${bw ? 'win' : ''}">${fmtN(bv)}</td><td class="${gw ? 'win' : ''}">${fmtN(gv)}</td></tr>`;
  };
  $('#cmpBody').innerHTML =
    row('Recorridos de la ciudad', b ? K : null, 1) +
    row('Esquinas procesadas', b ? b.counts.visits : null, g.counts.visits) +
    row('Cuadras revisadas', b ? b.counts.edges : null, g.counts.edges) +
    row('Actualizaciones de molestia / inserciones en el heap', b ? b.counts.writes : null, g.counts.writes) +
    row('Operaciones totales', bOps, gOps) +
    '<tr><td>Tiempo</td><td>O(K·M·N)</td><td>O((M·N+K)·log(M·N+K))</td></tr>' +
    '<tr><td>Espacio</td><td>O(M·N+B)</td><td>O(M·N+K+B)</td></tr>' +
    '<tr><td>Peor caso del problema</td><td>~10¹¹ operaciones</td><td>~10⁸ operaciones</td></tr>' +
    '<tr><td>Gana cuando</td><td>K es 1 o 2</td><td>K es mediano o grande</td></tr>' +
    '<tr><td>Simplicidad</td><td>traducción literal de la definición</td><td>necesita un argumento de correctitud (el origen ficticio)</td></tr>';
  const same = b && b.res.max === g.res.max && b.res.list.join() === g.res.list.join();
  $('#cmpNote').innerHTML = b
    ? `Con este caso la fuerza bruta hace <b>${(bOps / gOps).toFixed(1)}×</b> el trabajo de Dijkstra (multi-fuente); la diferencia crece con K. Resultado de ambas: ${same ? '✅ coinciden' : '❌ NO coinciden'}.`
    : `La fuerza bruta no se ejecutó en el navegador: haría unas ${fmtN(K * P.V)} visitas de esquinas.`;
}

/* ------------------------- formulario del caso ------------------------- */
function renderForm() {
  $('#fM').value = model.M;
  $('#fN').value = model.N;
  $('#sizeInfo').textContent = `${(model.M * model.N).toLocaleString('es')} esquinas · ${((model.M - 1) * model.N + model.M * (model.N - 1)).toLocaleString('es')} cuadras`;
  $('#kBadge').textContent = `K = ${model.src.length}`;
  $('#bBadge').textContent = `B = ${model.cuts.length}`;

  if (model.src.length > MAX_ROWS) {
    $('#srcWrap').innerHTML = `<div class="small text-body-secondary">Hay ${model.src.length} tumultuosas: para editarlas usá <code>barrio.in</code>.</div>`;
  } else {
    $('#srcWrap').innerHTML = `<div class="list-scroll"><table class="table table-sm rows"><thead><tr><th></th><th>x</th><th>y</th><th>nivel v</th><th></th></tr></thead><tbody>` +
      model.src.map((s, i) => `<tr>
        <td class="idx"><span class="dot" style="background:hsl(${hue(i)} 70% 45%)"></span>${i + 1}</td>
        <td><input type="number" class="form-control" data-src="${i}" data-k="x" value="${s.x}" min="1" max="${model.M}" aria-label="x de la tumultuosa ${i + 1}"></td>
        <td><input type="number" class="form-control" data-src="${i}" data-k="y" value="${s.y}" min="1" max="${model.N}" aria-label="y de la tumultuosa ${i + 1}"></td>
        <td><input type="number" class="form-control" data-src="${i}" data-k="v" value="${s.v}" min="0" max="1000" aria-label="nivel v de la tumultuosa ${i + 1}"></td>
        <td><button class="btn btn-sm btn-outline-danger del" data-del-src="${i}" title="Quitar" ${model.src.length === 1 ? 'disabled' : ''}>✕</button></td>
      </tr>`).join('') + '</tbody></table></div>';
  }

  if (model.cuts.length > MAX_ROWS) {
    $('#cutWrap').innerHTML = `<div class="small text-body-secondary">Hay ${model.cuts.length} cuadras cortadas: para editarlas usá <code>barrio.in</code>.</div>`;
  } else if (!model.cuts.length) {
    $('#cutWrap').innerHTML = '<div class="small text-body-secondary">No hay cuadras cortadas.</div>';
  } else {
    $('#cutWrap').innerHTML = `<div class="list-scroll"><table class="table table-sm rows"><thead><tr><th></th><th>desde x</th><th>y</th><th>hacia</th><th></th></tr></thead><tbody>` +
      model.cuts.map((c, i) => `<tr>
        <td class="idx">${i + 1}</td>
        <td><input type="number" class="form-control" data-cut="${i}" data-k="x" value="${c.x}" min="1" max="${model.M}" aria-label="x de la cuadra ${i + 1}"></td>
        <td><input type="number" class="form-control" data-cut="${i}" data-k="y" value="${c.y}" min="1" max="${model.N}" aria-label="y de la cuadra ${i + 1}"></td>
        <td><select class="form-select" data-cut="${i}" data-k="dir" aria-label="dirección de la cuadra ${i + 1}">
          <option value="E" ${c.dir === 'E' ? 'selected' : ''}>→ este (${c.x + 1}, ${c.y})</option>
          <option value="N" ${c.dir === 'N' ? 'selected' : ''}>↑ norte (${c.x}, ${c.y + 1})</option>
        </select></td>
        <td><button class="btn btn-sm btn-outline-danger del" data-del-cut="${i}" title="Quitar">✕</button></td>
      </tr>`).join('') + '</tbody></table></div>';
  }
}

function readForm() {
  const int = v => v === '' ? NaN : Number(v);
  model.M = int($('#fM').value);
  model.N = int($('#fN').value);
  $$('[data-src]').forEach(el => { model.src[Number(el.dataset.src)][el.dataset.k] = int(el.value); });
  $$('[data-cut]').forEach(el => {
    const c = model.cuts[Number(el.dataset.cut)];
    c[el.dataset.k] = el.dataset.k === 'dir' ? el.value : int(el.value);
  });
}

function showFormError(err) {
  $$('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  const box = $('#formError');
  if (!err) { box.classList.add('d-none'); return; }
  box.textContent = err.message;
  box.classList.remove('d-none');
  if (err.sel) { const el = $(err.sel); if (el) el.classList.add('is-invalid'); }
}

/* aplica el modelo actual: valida, corre los dos algoritmos y redibuja */
function applyModel({ keepEnd = false, rerenderForm = true } = {}) {
  stop();
  if (rerenderForm) renderForm();
  let built;
  try { built = buildProblem(model); }
  catch (err) { showFormError(err); return false; }
  showFormError(null);
  $('#input').value = serialize(model);
  $('#inputError').classList.add('d-none');

  P = built;
  selected = -1;
  const K = P.src.length, draw = P.V <= MAX_DRAW;
  RUN.greedy = runGreedy(draw && 2 * K + 5 * P.V + 1 <= MAX_EVENTS);
  RUN.brute = K * P.V <= MAX_BRUTE_WORK ? runBrute(draw && 2 * K * P.V + K + 1 <= MAX_EVENTS) : null;
  if (!RUN.brute && mode === 'brute') mode = 'greedy';
  $('#modeBrute').disabled = !RUN.brute;
  buildSvg();
  renderCompare();
  S = null; step = 0;
  goTo(keepEnd ? totalSteps() : 0);
  return true;
}

function loadText(text) {
  try { model = parseText(text); }
  catch (err) {
    $('#inputError').textContent = err.message;
    $('#inputError').classList.remove('d-none');
    return false;
  }
  return applyModel();
}

function loadPreset(id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return;
  $('#preset').value = id;
  $('#presetDesc').textContent = p.desc;
  if (p.gen) { model = generate(p.gen); applyModel(); }
  else loadText(p.text);
}

/* edición directa sobre la grilla */
function onGridClick(ev) {
  const hit = ev.target.closest('.hit');
  if (hit) {
    const k = Number(hit.dataset.e), a = Math.floor(k / P.V), b = k % P.V;   // a < b
    const c = b === a + 1 ? { x: X(a), y: Y(a), dir: 'E' } : { x: X(a), y: Y(a), dir: 'N' };
    const idx = model.cuts.findIndex(o => o.x === c.x && o.y === c.y && o.dir === c.dir);
    if (idx >= 0) model.cuts.splice(idx, 1); else model.cuts.push(c);
    markCustom();
    applyModel({ keepEnd: true });
    return;
  }
  const node = ev.target.closest('.node');
  if (!node) return;
  const u = Number(node.dataset.u);
  if (ev.shiftKey) {
    const has = model.src.some(s => s.x === X(u) && s.y === Y(u));
    if (has) {
      if (model.src.length === 1) return;
      model.src = model.src.filter(s => !(s.x === X(u) && s.y === Y(u)));
    } else {
      const v = Math.max(0, Math.min(1000, parseInt($('#newV').value, 10) || 0));
      model.src.push({ x: X(u), y: Y(u), v });
    }
    markCustom();
    applyModel({ keepEnd: true });
    return;
  }
  selected = selected === u ? -1 : u;
  render();
}

function markCustom() {
  $('#preset').value = 'custom';
  $('#presetDesc').textContent = 'Caso armado a mano.';
}

/* --------------------------- generador --------------------------------- */
function rng(seed) {   // mulberry32: aleatorio reproducible si hay semilla
  if (seed == null) return Math.random;
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function generate({ M, N, K, vmax, B, seed }) {
  const r = rng(seed), ri = n => Math.floor(r() * n);
  const src = [];
  for (let i = 0; i < K; i++) src.push({ x: 1 + ri(M), y: 1 + ri(N), v: ri(vmax + 1) });
  const total = (M - 1) * N + M * (N - 1);
  B = Math.min(B, total);
  const seen = new Set(), cuts = [];
  let tries = 0;
  while (cuts.length < B && tries++ < B * 30 + 100) {
    const dir = r() < 0.5 ? 'E' : 'N';
    const x = 1 + ri(dir === 'E' ? M - 1 : M), y = 1 + ri(dir === 'N' ? N - 1 : N);
    if ((dir === 'E' && M < 2) || (dir === 'N' && N < 2)) continue;
    const k = `${x},${y},${dir}`;
    if (seen.has(k)) continue;
    seen.add(k); cuts.push({ x, y, dir });
  }
  return { M, N, src, cuts };
}

/* ----------------------------- reproducción ---------------------------- */
function delay() {
  const s = Number($('#speed').value);        // 0..100
  return Math.round(900 * Math.pow(0.93, s)); // ~900 ms … ~0,6 ms
}
function tick() {
  if (!playing) return;
  if (step >= totalSteps()) { stop(); render(); return; }
  const d = delay();
  const per = d < 16 ? Math.ceil(16 / Math.max(d, 0.5)) : 1;  // varios pasos por cuadro si es muy rápido
  goTo(step + per);
  timer = setTimeout(tick, Math.max(d, 16));
}
function play() {
  if (step >= totalSteps()) goTo(0);
  playing = true; selected = -1; render(); tick();
}
function stop() { playing = false; clearTimeout(timer); }

/* ------------------------------ utilidades ----------------------------- */
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function setTheme(t) {
  document.documentElement.dataset.bsTheme = t;
  $('#btnTheme').textContent = t === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('barrio-theme', t); } catch (_) {}
}

/* ---------------- panel izquierdo: ancho ajustable y ocultable ---------------- */
let rebuildTimer = null;
function rebuildGridSoon(delay = 60) {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { if (P) { buildSvg(); paintGrid(); } }, delay);
}

function initLayout() {
  const side = $('#side'), sp = $('#splitter'), layout = side.parentElement;
  const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} };
  const load = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };

  const setTop = () => document.documentElement.style.setProperty('--top', $('.topbar').offsetHeight + 'px');
  setTop();
  window.addEventListener('resize', setTop);

  const clampW = w => Math.round(Math.max(220, Math.min(layout.getBoundingClientRect().width * 0.7, w)));
  const setWidth = w => { side.style.width = clampW(w) + 'px'; };
  const saved = Number(load('barrio-side-w'));
  if (saved) setWidth(saved);

  const setHidden = h => {
    side.classList.toggle('hidden', h);
    $('#btnSide').textContent = h ? '⇥ Panel' : '⇤ Panel';
    $('#btnSide').classList.toggle('active', h);
    store('barrio-side-hidden', h ? '1' : null);
    rebuildGridSoon(0);
  };
  setHidden(load('barrio-side-hidden') === '1');
  $('#btnSide').onclick = () => setHidden(!side.classList.contains('hidden'));

  let dragging = false;
  sp.addEventListener('pointerdown', e => {
    if (side.classList.contains('hidden')) { setHidden(false); return; }
    dragging = true;
    sp.setPointerCapture(e.pointerId);
    sp.classList.add('drag');
    document.body.style.userSelect = 'none';
  });
  sp.addEventListener('pointermove', e => {
    if (!dragging) return;
    setWidth(e.clientX - layout.getBoundingClientRect().left);
    rebuildGridSoon();
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    sp.classList.remove('drag');
    document.body.style.userSelect = '';
    store('barrio-side-w', parseInt(side.style.width, 10));
    rebuildGridSoon(0);
  };
  sp.addEventListener('pointerup', endDrag);
  sp.addEventListener('pointercancel', endDrag);
  sp.addEventListener('dblclick', () => {
    side.style.width = '';
    store('barrio-side-w', null);
    rebuildGridSoon(0);
  });
  sp.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); e.stopPropagation();
    setWidth(side.getBoundingClientRect().width + (e.key === 'ArrowRight' ? 30 : -30));
    store('barrio-side-w', parseInt(side.style.width, 10));
    rebuildGridSoon();
  });
}

/* -------------------------------- init --------------------------------- */
function init() {
  initLayout();
  let theme = 'dark';
  try { theme = localStorage.getItem('barrio-theme') || 'dark'; } catch (_) {}
  setTheme(theme);

  // tarjetas achicables: botón Ocultar/Mostrar, alto ajustable desde la esquina inferior
  // derecha (se recuerda), y doble clic en el encabezado para volver al tamaño original
  $$('.collapse-btn').forEach(btn => {
    const body = $('#' + btn.dataset.collapse), key = 'barrio-col-' + body.id;
    const set = c => {
      body.classList.toggle('collapsed', c);
      btn.textContent = c ? '▸ Mostrar' : '▾ Ocultar';
      try { localStorage.setItem(key, c ? '1' : '0'); } catch (_) {}
    };
    let c = false;
    try { c = localStorage.getItem(key) === '1'; } catch (_) {}
    set(c);
    btn.onclick = () => set(!body.classList.contains('collapsed'));
    btn.title = 'Ocultar o mostrar. Arrastrá la esquina inferior derecha para cambiar el alto; doble clic en el encabezado lo restablece.';
    btn.closest('.card-header').addEventListener('dblclick', e => {
      if (e.target === btn) return;
      body.style.height = '';
      try { localStorage.removeItem('barrio-h-' + body.id); } catch (_) {}
    });
  });
  $$('.resizable').forEach(el => {
    const key = 'barrio-h-' + el.id;
    try { const h = localStorage.getItem(key); if (h) el.style.height = h; } catch (_) {}
    new ResizeObserver(() => {
      if (el.style.height) { try { localStorage.setItem(key, el.style.height); } catch (_) {} }
    }).observe(el);
  });

  $('#preset').innerHTML = PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('') +
    '<option value="custom" disabled>Caso armado a mano</option>';
  $('#preset').onchange = e => loadPreset(e.target.value);

  // formulario: cualquier cambio se aplica al instante
  const card = $('#fM').closest('.card-body');
  card.addEventListener('change', e => {
    if (!e.target.matches('#fM, #fN, [data-src], [data-cut]')) return;
    readForm(); markCustom();
    applyModel({ rerenderForm: !e.target.matches('[data-src], [data-cut]') || e.target.dataset.k === 'dir' });
  });
  card.addEventListener('click', e => {
    const ds = e.target.closest('[data-del-src]'), dc = e.target.closest('[data-del-cut]');
    if (ds) { readForm(); model.src.splice(Number(ds.dataset.delSrc), 1); markCustom(); applyModel(); }
    if (dc) { readForm(); model.cuts.splice(Number(dc.dataset.delCut), 1); markCustom(); applyModel(); }
  });
  $('#addSrc').onclick = () => {
    readForm();
    model.src.push({ x: Math.ceil(model.M / 2) || 1, y: Math.ceil(model.N / 2) || 1, v: 0 });
    markCustom(); applyModel();
  };
  $('#addCut').onclick = () => {
    readForm();
    const used = new Set(model.cuts.map(c => `${c.x},${c.y},${c.dir}`));
    let c = { x: 1, y: 1, dir: model.M > 1 ? 'E' : 'N' };
    outer: for (let y = 1; y <= model.N; y++) for (let x = 1; x <= model.M; x++) for (const dir of ['E', 'N']) {
      if ((dir === 'E' && x >= model.M) || (dir === 'N' && y >= model.N)) continue;
      if (!used.has(`${x},${y},${dir}`)) { c = { x, y, dir }; break outer; }
    }
    model.cuts.push(c);
    markCustom(); applyModel();
  };
  $('#btnGen').onclick = () => {
    const n = (sel, lo, hi) => Math.max(lo, Math.min(hi, parseInt($(sel).value, 10) || lo));
    const M = n('#gM', 1, 1000), N = n('#gN', 1, 1000);
    model = generate({ M, N, K: n('#gK', 1, 100000), vmax: n('#gV', 0, 1000), B: n('#gB', 0, 2e6) });
    $('#preset').value = 'custom';
    $('#presetDesc').textContent = `Caso aleatorio: ${M} × ${N}, K = ${model.src.length}, B = ${model.cuts.length}.`;
    applyModel();
  };
  $('#btnApply').onclick = () => { if (loadText($('#input').value)) markCustom(); };

  $$('[data-mode]').forEach(b => b.onclick = () => {
    stop(); mode = b.dataset.mode; selected = -1; S = null; step = 0; goTo(0);
  });
  $('#btnFirst').onclick = () => { stop(); goTo(0); };
  $('#btnPrev').onclick = () => { stop(); goTo(step - 1); };
  $('#btnNext').onclick = () => { stop(); goTo(step + 1); };
  $('#btnLast').onclick = () => { stop(); goTo(totalSteps()); };
  $('#btnPlay').onclick = () => { if (playing) { stop(); render(); } else play(); };
  $('#scrub').oninput = e => { stop(); goTo(Number(e.target.value)); };
  $('#colorMode').onchange = () => paintGrid();
  $('#viewMode').onchange = () => {
    const table = $('#viewMode').value === 'table';
    $('#gridWrap').classList.toggle('d-none', table);
    $('#tableWrap').classList.toggle('d-none', !table);
    $('#colorMode').disabled = table;
    render();
  };
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
    model = { M: 6, N: 5, src: [{ x: 3, y: 3, v: 0 }], cuts: [] };
    $('#preset').value = 'custom'; $('#presetDesc').textContent = 'Caso nuevo: agregá tumultuosas y cuadras cortadas.';
    applyModel();
  };
  $('#btnShare').onclick = async () => {
    const url = location.href.split('#')[0] + '#in=' + encodeURIComponent(serialize(model));
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); $('#btnShare').textContent = '✅ Copiado'; }
    catch (_) { $('#btnShare').textContent = '🔗 En la URL'; }
    setTimeout(() => $('#btnShare').textContent = '🔗 Compartir', 1800);
  };

  document.addEventListener('keydown', e => {
    if (e.target.matches('textarea, input, select')) return;
    if (e.key === 'ArrowRight') { stop(); goTo(step + 1); }
    else if (e.key === 'ArrowLeft') { stop(); goTo(step - 1); }
    else if (e.key === ' ') { e.preventDefault(); if (playing) { stop(); render(); } else play(); }
  });

  window.addEventListener('resize', () => rebuildGridSoon(150));

  if (location.hash.startsWith('#in=')) {
    let text = '';
    try { text = decodeURIComponent(location.hash.slice(4)); } catch (_) {}
    if (text && loadText(text)) { markCustom(); $('#presetDesc').textContent = 'Caso cargado desde el link compartido.'; return; }
  }
  loadPreset('modificado');
}

init();

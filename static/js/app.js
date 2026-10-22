const $ = id => document.getElementById(id);
const ic = (p, c = 'w-5 h-5') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  vid: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 9l5 3-5 3z"/>',
  dir: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  move: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  undo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  drive: '<rect x="2" y="13" width="20" height="8" rx="2"/><path d="M5 13l2.5-9h9L19 13M6 17h.01M10 17h.01"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  fwd: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  play: '<path d="M6 4l14 8-14 8z" fill="currentColor"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  zin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
  zout: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  playc: '<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z"/>',
  rew: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  ff: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'
};

/* ---------- Estado y variables globales ---------- */
let view = 'inicio', cwd = '/', q = '';
let drv = null, drvName = '', homeCwd = '/', CLIP = null, HIST = [], hpos = -1;
let SERVER_FILES = [];
let loading = false, loadTok = 0, DOCKER = false;
const isDrv = () => view === 'unidades' && !!drv;                 // dentro de una unidad
const curDrive = () => (view === 'unidades' && drv) || 'sistema';
const isFiles = () => view === 'unidades' ? isDrv() : (!VIEWS[view].k || VIEWS[view].k === 'trash');
const curActs = () => isDrv() ? ['crear', 'copiar', 'subir', 'descargar', 'mover', 'pegar', 'eliminar'] : (VIEWS[view].a || []);
const sel = new Set();
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fd = d => d.split('-').reverse().join('/');
const fmt = b => { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1000 && i < 4) { b /= 1000; i++; } return (i ? +b.toFixed(b < 10 ? 1 : 0) : b) + ' ' + u[i]; };
const bar = p => `<div class="h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar"><div class="h-full rounded-full ${p > 85 ? 'bg-red-500' : 'grad'}" style="width:${p}%"></div></div>`;

let tt;
function toast(m) {
  const t = $('toast');
  t.textContent = m;
  t.classList.remove('hidden');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.add('hidden'), 2800);
}

/* ---------- Vistas / Menu ---------- */
const RAIL = [['inicio', 'Inicio', 'home'], ['favoritos', 'Favoritos', 'star'], ['imagenes', 'Imágenes', 'img'], ['videos', 'Videos', 'vid']];
const MENU = [['recientes', 'Recientes'], ['todos', 'Todos los archivos/carpetas'], ['rendimiento', 'Rendimiento'], ['papelera', 'Papelera'], ['unidades', 'Unidades de almacenamiento']];
const VIEWS = {
  inicio: { t: 'Inicio', a: ['crear', 'copiar', 'subir', 'descargar', 'mover', 'pegar', 'eliminar'] },
  favoritos: { t: 'Favoritos', a: ['quitar'] },
  imagenes: { t: 'Imágenes', a: ['copiar', 'descargar', 'eliminar'] },
  videos: { t: 'Videos', a: ['copiar', 'descargar', 'eliminar'] },
  recientes: { t: 'Recientes', a: ['copiar', 'descargar', 'eliminar'] },
  todos: { t: 'Todos los archivos', a: ['copiar', 'descargar', 'eliminar'] },
  papelera: { t: 'Papelera', k: 'trash', a: ['restaurar', 'borrar', 'vaciar'] },
  rendimiento: { t: 'Rendimiento', k: 'perf' },
  unidades: { t: 'Unidades de almacenamiento', k: 'disks' }
};
const ACT = {
  crear: ['Crear', I.plus, 0], copiar: ['Copiar', I.copy, 1], subir: ['Subir', I.up, 0], mover: ['Mover', I.move, 1],
  eliminar: ['Eliminar', I.trash, 1], agregar: ['Agregar', I.plus, 0], pegar: ['Pegar', I.paste, 2], descargar: ['Descargar', I.download, 1], quitar: ['Eliminar de Favoritos', I.trash, 1],
  restaurar: ['Restaurar', I.undo, 1], borrar: ['Eliminar definitivamente', I.trash, 1], vaciar: ['Vaciar papelera', I.trash, 0]
};

/* ---------- Cargar Archivos desde el Backend ---------- */
const SRC = {
  recientes: '/api/files/recent', todos: '/api/files/all', imagenes: '/api/files/all?type=img',
  videos: '/api/files/all?type=vid', favoritos: '/api/favorites', papelera: '/api/trash/list'
};

async function loadFiles() {
  const tok = ++loadTok;
  loading = true;
  const lst = `/api/files/list?path=${encodeURIComponent(cwd)}` + (isDrv() ? `&drive=${drv}` : '');
  const url = view === 'unidades' ? (drv ? lst : '/api/drives') : (SRC[view] || lst);
  let failed = false;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al leer archivos');
    const data = await res.json();
    if (tok !== loadTok) return; // ya se cambió de sección
    SERVER_FILES = data.items || [];
    if (view === 'unidades' && !drv) DOCKER = !!data.docker;
  } catch (err) {
    if (tok !== loadTok) return;
    SERVER_FILES = [];
    failed = true;
  }
  loading = false;
  for (const p of [...sel]) if (!SERVER_FILES.some(x => x.p === p)) sel.delete(p);
  render();
  if (failed) toast('No se pudieron cargar los archivos del servidor');
}

const items = () => {
  const s = q.trim().toLowerCase();
  return s ? SERVER_FILES.filter(x => x.n.toLowerCase().includes(s)) : SERVER_FILES;
};

/* ---------- Renderizado de la Tabla ---------- */
function rowHtml(x) {
  const trash = view === 'papelera';
  const name = x.t === 'dir' && !trash
    ? `<button class="truncate text-left hover:underline font-medium" data-go="${esc(x.p)}">${esc(x.n)}</button>`
    : `<span class="truncate">${esc(x.n)}</span>`;
  const star = trash || isDrv() ? '' : `<button data-fav="${esc(x.p)}" aria-pressed="${!!x.fav}" class="shrink-0 ${x.fav ? 'text-yellow-300' : 'text-white/30 hover:text-white'}" aria-label="${x.fav ? 'Quitar de favoritos' : 'Marcar como favorito'}: ${esc(x.n)}">${ic(I.star, 'w-4 h-4' + (x.fav ? ' fill-current' : ''))}</button>`;
  const openBtn = trash || (x.t !== 'img' && x.t !== 'vid') ? '' : `<button data-open="${esc(x.p)}" class="shrink-0 text-white/50 hover:text-white" aria-label="${x.t === 'vid' ? 'Reproducir' : 'Ver'}: ${esc(x.n)}" title="${x.t === 'vid' ? 'Reproducir' : 'Ver imagen'}">${ic(x.t === 'vid' ? I.playc : I.eye, 'w-4 h-4')}</button>`;
  const loc = trash ? (x.dr && x.dr !== 'sistema' ? `${x.dn}: ${x.o}` : x.o) : (x.p.slice(0, x.p.lastIndexOf('/')) || '/');
  const where = view === 'inicio' || isDrv() ? '' : `<span class="hidden lg:inline truncate text-xs text-white/40">${trash ? 'de' : 'en'} ${esc(loc)}</span>`;
  return `<div class="row select-none hover:bg-white/5 ${sel.has(x.p) ? 'on' : ''}" data-p="${esc(x.p)}">
    <input type="checkbox" data-sel="${esc(x.p)}" ${sel.has(x.p) ? 'checked' : ''} aria-label="Seleccionar ${esc(x.n)}">
    <div class="flex items-center gap-2 min-w-0">${ic(I[x.t] || I.doc)}${name}${openBtn}${star}${where}</div>
    <span class="hidden md:block text-white/90">${fd(x.d)}</span>
    <span class="text-white/90">${x.t === 'dir' ? '--' : fmt(x.s)}</span></div>`;
}

function table(l) {
  const trash = view === 'papelera';
  if (!l.length) {
    const msgs = { papelera: 'La papelera está vacía.', favoritos: 'Aún no tienes favoritos. Marca la estrella junto a un archivo o carpeta.', inicio: 'Esta carpeta está vacía. Usa Crear o Subir para añadir contenido.' };
    msgs.unidades = msgs.inicio;
    const m = loading ? 'Cargando…' : q ? `Ningún resultado para “${esc(q)}”.` : (msgs[view] || 'No hay elementos que mostrar aquí.');
    return `<p class="py-10 text-white/60">${m}</p>`;
  }
  return `<div class="row text-white/60 border-t border-white/30 rounded-none"><input id="all" type="checkbox" aria-label="Seleccionar todo"><span>Nombre</span><span class="hidden md:block">${trash ? 'Fecha de eliminación' : 'Fecha de modificación'}</span><span>Tamaño</span></div>` + l.map(rowHtml).join('');
}

/* ---------- Rendimiento Real ---------- */
const NPTS = 30;
const PF = { tab: 'cpu', data: null, err: false, timer: null, h: { cpu: [], ram: [], rx: [], tx: [] } };
const PF_TABS = [['cpu', 'CPU'], ['ram', 'RAM'], ['disk', 'SSD del sistema'], ['net', 'WiFi']];
const spd = t => { const m = /([\d.]+)\s*(B|KB|MB)/.exec(t || ''); return m ? +m[1] * { B: 1, KB: 1024, MB: 1048576 }[m[2]] : 0; };
const fmtB = b => b < 1024 ? b.toFixed(0) + ' B/s' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB/s' : (b / 1048576).toFixed(1) + ' MB/s';
const st = (l, v) => `<div><p class="font-semibold">${l}</p><p class="text-white/80 break-all">${esc(String(v))}</p></div>`;
const grid = a => `<div class="grid sm:grid-cols-2 gap-x-10 gap-y-5 mb-6">${a.join('')}</div>`;

function area(series, o) {
  const W = 600, H = 220, l = 70, r = 10, t = 12, b = 18, step = (W - l - r) / (NPTS - 1);
  const max = o.top(Math.max(0, ...series.flatMap(s => s.v)));
  const y = v => t + (H - t - b) * (1 - v / max);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, yy = y(v);
    g += `<line x1="${l}" x2="${W - r}" y1="${yy}" y2="${yy}" stroke="rgba(255,255,255,.18)"/><text x="${l - 8}" y="${yy + 4}" text-anchor="end" fill="rgba(255,255,255,.7)" font-size="12">${o.fmt(v)}</text>`;
  }
  const paths = series.map(s => {
    if (!s.v.length) return '';
    const x = i => l + (NPTS - s.v.length + i) * step, base = y(0);
    const pts = s.v.map((v, i) => `${x(i)},${y(v)}`).join(' L');
    return `<path d="M${x(0)},${base} L${pts} L${x(s.v.length - 1)},${base}Z" fill="${s.c}" fill-opacity="${series.length > 1 ? .55 : .95}" stroke="${s.c}" stroke-width="2"/>`;
  }).join('');
  const leg = series.map(s => `<span class="inline-flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${s.c}"></span>${s.n}</span>`).join('');
  return `<div class="flex justify-center gap-5 text-sm mb-2">${leg}</div><svg viewBox="0 0 ${W} ${H}" class="w-full max-w-3xl mx-auto" role="img">${g}${paths}</svg>`;
}

function donut(used) {
  const R = 70, C = 2 * Math.PI * R;
  return `<svg viewBox="0 0 200 200" class="w-52 h-52 shrink-0"><g fill="none" stroke-width="34" transform="rotate(-90 100 100)"><circle cx="100" cy="100" r="${R}" stroke="#4f7cff"/><circle cx="100" cy="100" r="${R}" stroke="#f0737a" stroke-dasharray="${C * used / 100} ${C}"/></g><text x="100" y="107" text-anchor="middle" fill="#fff" font-size="22" font-weight="600">${used}%</text></svg>`;
}

function drawPerf() {
  const el = $('pf'); if (!el) return;
  const d = PF.data;
  if (!d) { el.innerHTML = `<p class="py-10 text-white/60">${PF.err ? 'Error de conexión con el servidor.' : 'Leyendo métricas del sistema...'}</p>`; return; }
  const { cpu, ram, disk, network: net } = d;
  const pct = { top: r => Math.min(100, Math.max(20, Math.ceil(r * 1.25 / 10) * 10)), fmt: v => Math.round(v) + '%' };
  const bps = { top: r => Math.max(1024, r * 1.25), fmt: fmtB };
  let h = '';
  if (PF.tab === 'cpu') h += grid([st('Procesos', cpu.processes), st('Frecuencia', cpu.frequency_ghz + ' GHz'), st('Núcleos', `${cpu.cores_physical} físicos / ${cpu.cores_logical} lógicos`), st('Procesador', cpu.model), st('Uso actual', cpu.usage + ' %')]) + area([{ n: 'CPU %', c: '#f4b96a', v: PF.h.cpu }], { ...pct, label: 'Uso CPU' });
  else if (PF.tab === 'ram') h += grid([st('Memoria en Uso', `${ram.used_gb} / ${ram.total_gb} GB`), st('Porcentaje', ram.percent + ' %'), st('Disponible', ram.free_gb + ' GB')]) + area([{ n: 'RAM %', c: '#f0737a', v: PF.h.ram }], { ...pct, label: 'Uso RAM' });
  else if (PF.tab === 'disk') h += grid([st('Capacidad Total', disk.total_gb + ' GB'), st('Velocidad Escritura', disk.write_speed), st('Espacio Libre', disk.free_gb + ' GB'), st('Velocidad Lectura', disk.read_speed)]) + `<div class="flex items-center justify-center gap-8"><div>${donut(disk.percent)}</div></div>`;
  else h += grid([st('IPv4', net.ipv4), st('Envío', net.send_speed), st('Recepción', net.recv_speed)]) + area([{ n: 'Recepción', c: '#f0737a', v: PF.h.rx }, { n: 'Envío', c: '#4f7cff', v: PF.h.tx }], { ...bps, label: 'Tráfico Red' });
  el.innerHTML = h;
}

async function pollPerf() {
  try {
    const r = await fetch('/api/performance-details', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    const d = await r.json();
    const push = (k, v) => { PF.h[k].push(v); if (PF.h[k].length > NPTS) PF.h[k].shift(); };
    push('cpu', d.cpu.usage); push('ram', d.ram.percent); push('rx', spd(d.network.recv_speed)); push('tx', spd(d.network.send_speed));
    PF.data = d; PF.err = false;
  } catch (e) { PF.err = true; }
  if (view === 'rendimiento') drawPerf();
}

function perfStart() { drawPerf(); if (!PF.timer) { pollPerf(); PF.timer = setInterval(pollPerf, 2000); } }
function perfStop() { if (PF.timer) { clearInterval(PF.timer); PF.timer = null; PF.h = { cpu: [], ram: [], rx: [], tx: [] }; } }

const perf = () => `<div role="tablist" aria-label="Componentes del sistema" class="flex flex-wrap items-center text-sm mb-6">${PF_TABS.map(([k, l], n) => `${n ? '<span class="h-4 w-px bg-white/30"></span>' : ''}<button role="tab" data-pf="${k}" aria-selected="${PF.tab === k}" class="px-4 py-1.5 rounded-full ${PF.tab === k ? 'bg-[#1b2a5c] text-white' : 'text-white/60 hover:text-white'}">${l}</button>`).join('')}</div><div id="pf"></div>`;

const unmountedCard = d => `<div class="rounded-xl px-3 py-5 border-b border-white/10 flex items-center gap-4">${ic(I.drive, 'w-9 h-9 shrink-0 text-white/50')}<div class="flex-1 min-w-0"><div class="flex justify-between gap-4"><span class="font-semibold truncate">${esc(d.name)} <span class="ml-2 text-xs font-normal rounded-full bg-amber-400/20 text-amber-300 px-2 py-0.5">Sin montar</span></span><span class="text-white/70 text-sm shrink-0">${fmt(d.total)}</span></div><p class="text-xs text-white/50 mb-2 truncate">${esc(d.model || 'Disco')} · ${esc(d.device)}</p><p class="text-xs text-white/60 mb-1">Está conectada, pero aún no está montada${DOCKER ? ' (o el contenedor no la ve)' : ''}. En Debian ejecuta:</p><code class="block text-xs bg-white/10 rounded px-2 py-1 select-all break-all">sudo mkdir -p /mnt/disco &amp;&amp; sudo mount ${esc(d.device)} /mnt/disco</code>${DOCKER ? '<p class="text-xs text-white/60 mt-2">Si ya está montada en Debian, reinicia el contenedor con <code class="select-all">-v /mnt:/mnt:rslave -v /media:/media:rslave</code>.</p>' : ''}</div></div>`;
const drivesHtml = () => !SERVER_FILES.length
  ? `<p class="py-10 text-white/60">${loading ? 'Buscando unidades…' : 'No se detectó ninguna unidad.'}</p>`
  : SERVER_FILES.map(d => d.kind === 'sin_montar' ? unmountedCard(d) : `<button data-drv="${esc(d.id)}" class="w-full text-left rounded-xl px-3 py-5 border-b border-white/10 hover:bg-white/5 flex items-center gap-4">${ic(I.drive, 'w-9 h-9 shrink-0')}<div class="flex-1 min-w-0"><div class="flex justify-between gap-4"><span class="font-semibold truncate">${esc(d.name)}</span><span class="text-white/70 text-sm shrink-0">${fmt(d.free)} libres de ${fmt(d.total)}</span></div><p class="text-xs text-white/50 mb-2 truncate">${d.kind === 'sistema' ? 'Almacenamiento del sistema' : 'Unidad externa'} · ${esc(d.fstype || 'sin formato')} · ${esc(d.device || d.mount)}</p>${bar(d.percent)}</div></button>`).join('')
    + '<p class="text-xs text-white/40 mt-4">La lista se actualiza sola al conectar o quitar una unidad.</p>';

function body() {
  if (view === 'unidades' && !drv) return drivesHtml();
  return VIEWS[view].k === 'perf' ? perf() : table(items());
}

const crumbs = () => {
  let p = '';
  const segs = cwd.split('/').filter(Boolean).map(s => { p += '/' + s; return ` / <button class="hover:underline" data-go="${esc(p)}">${esc(s)}</button>`; }).join('');
  return isDrv()
    ? `<button class="hover:underline" data-v="unidades">Unidades</button> / <button class="hover:underline" data-go="/">${esc(drvName)}</button>${segs}`
    : `<button class="hover:underline" data-go="/">root</button>${segs}`;
};

function sync() {
  const n = sel.size;
  $('count').textContent = `Seleccionados: ${n} elemento${n === 1 ? '' : 's'}` + (CLIP ? ` · Portapapeles: ${CLIP.paths.length} para ${CLIP.mode === 'move' ? 'mover' : 'copiar'}` : '');
  document.querySelectorAll('[data-need]').forEach(b => b.disabled = !n);
  document.querySelectorAll('[data-clip]').forEach(b => b.disabled = !CLIP);
  const all = $('all'), l = items();
  if (all) all.checked = l.length > 0 && l.every(x => sel.has(x.p));
}

function render() {
  const files = isFiles();
  $('title').textContent = isDrv() ? drvName : VIEWS[view].t;
  document.title = $('title').textContent + ' - NAS Dashboard';
  $('path').innerHTML = view === 'inicio' || isDrv() ? crumbs() : '';
  $('acts').innerHTML = curActs().map(a => { const [l, i, n] = ACT[a]; return `<button class="pill" data-act="${a}" ${n === 1 ? 'data-need disabled' : n === 2 ? 'data-clip disabled' : ''}>${ic(i, 'w-4 h-4')}${l}</button>`; }).join('');
  $('q').classList.toggle('hidden', !files);
  $('count').classList.toggle('hidden', !files);
  $('view').innerHTML = body();
  view === 'rendimiento' ? perfStart() : perfStop();
  document.querySelectorAll('[data-v]').forEach(b => {
    const on = b.dataset.v === view;
    b.classList.toggle('on', on);
    on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  $('back').disabled = hpos <= 0;
  $('fwd').disabled = hpos >= HIST.length - 1;
  sync();
}

/* Navegación con historial (atrás / adelante) */
const here = () => ({ view, cwd, drv, dn: drvName });
function navTo(s, push = true) {
  if (push && JSON.stringify(s) !== JSON.stringify(HIST[hpos])) { HIST = HIST.slice(0, hpos + 1); HIST.push(s); hpos++; }
  view = s.view; cwd = s.cwd; drv = s.drv; drvName = s.dn || '';
  if (view === 'inicio') homeCwd = cwd;
  sel.clear(); q = ''; $('q').value = '';
  $('side').classList.remove('open'); $('scrim').classList.add('hidden');
  SERVER_FILES = []; loadTok++; loading = false;
  if (isFiles() || view === 'unidades') loadFiles();
  render();
}
const setView = v => navTo({ view: v, cwd: v === 'inicio' ? homeCwd : '/', drv: null, dn: '' });

/* ---------- Acciones Reales contra la API de Flask ---------- */
async function act(url, body, ok, done) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error();
    const r = await res.json().catch(() => ({}));
    sel.clear();
    done ? done(r) : toast(ok);
    loadFiles();
  } catch (e) { toast('No se pudo completar la acción'); }
}

async function toggleFav(p) {
  const x = SERVER_FILES.find(y => y.p === p);
  if (!x) return;
  const want = !x.fav;
  try {
    const res = await fetch('/api/favorites/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: [p], fav: want }) });
    if (!res.ok) throw new Error();
    x.fav = want ? 1 : 0;
    if (view === 'favoritos' && !want) { SERVER_FILES = SERVER_FILES.filter(y => y !== x); sel.delete(p); }
    toast(want ? 'Añadido a Favoritos' : 'Quitado de Favoritos');
    render();
  } catch (e) { toast('No se pudo actualizar Favoritos'); }
}

function run(a) {
  const paths = Array.from(sel), n = paths.length, dr = curDrive();
  if (a === 'subir') return $('up').click();
  if (a === 'descargar') return downloadSelected(paths, dr);
  if (a === 'copiar' || a === 'mover') {
    CLIP = { mode: a === 'mover' ? 'move' : 'copy', drive: dr, paths };
    sel.clear(); render();
    return toast(`Portapapeles: ${n} elemento${n > 1 ? 's' : ''} para ${a === 'mover' ? 'mover' : 'copiar'}. Abre la carpeta destino y pulsa Pegar.`);
  }
  if (a === 'pegar') {
    if (!CLIP) return;
    const c = CLIP;
    return act('/api/files/paste', { mode: c.mode, src_drive: c.drive, paths: c.paths, dest_drive: dr, dest_path: cwd }, '', r => {
      if (c.mode === 'move' && r.done && !r.errors) CLIP = null;
      toast(r.errors ? `Pegado con ${r.errors} error(es)` : r.done ? 'Pegado' : 'No se pegó nada (¿es la misma carpeta?)');
    });
  }
  if (a === 'crear') {
    const nm = prompt('Nombre de la nueva carpeta:');
    if (nm && nm.trim()) act('/api/files/mkdir', { path: cwd, name: nm.trim(), drive: dr }, 'Carpeta creada');
  }
  else if (a === 'eliminar') act('/api/files/delete', { paths, drive: dr }, 'Movido a la papelera');
  else if (a === 'quitar') act('/api/favorites/toggle', { paths, fav: false }, 'Quitado de Favoritos');
  else if (a === 'restaurar') act('/api/trash/restore', { ids: paths }, 'Restaurado');
  else if (a === 'borrar') { if (confirm(`¿Eliminar definitivamente ${n} elemento(s)? No se puede deshacer.`)) act('/api/trash/delete', { ids: paths }, 'Eliminado definitivamente'); }
  else if (a === 'vaciar') { if (SERVER_FILES.length && confirm('¿Vaciar la papelera? No se puede deshacer.')) act('/api/trash/delete', { all: true }, 'Papelera vaciada'); }
}

function downloadSelected(paths, dr) {
  const files = paths.filter(p => SERVER_FILES.some(x => x.p === p && x.t !== 'dir'));
  if (!files.length) return toast('Por ahora solo se pueden descargar archivos, no carpetas.');
  files.forEach((p, n) => setTimeout(() => {
    const a = document.createElement('a');
    a.href = `/api/files/download?drive=${encodeURIComponent(dr)}&path=${encodeURIComponent(p)}`;
    a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  }, n * 500));
  toast(files.length < paths.length ? `Descargando ${files.length} archivo(s); las carpetas se omiten.` : files.length === 1 ? 'Descarga iniciada' : `Descargando ${files.length} archivos`);
}

/* ---------- Subida por partes (soporta archivos de decenas de GB y se puede reanudar) ---------- */
const CHUNK = 16 * 1024 * 1024;
const UP = { active: false, cancel: false, xhr: null, lock: null, timer: null };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const upKey = f => `${f.name}|${f.size}|${f.lastModified}`;
const fmtEta = s => s < 60 ? `${Math.ceil(s)} s` : s < 3600 ? `${Math.ceil(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.ceil(s % 3600 / 60)} min`;

// Aviso del navegador si se intenta cerrar o recargar la pestaña mientras se sube
window.addEventListener('beforeunload', e => { if (UP.active) { e.preventDefault(); e.returnValue = ''; } });

document.body.insertAdjacentHTML('beforeend', `<div id="upbox" role="status" aria-live="polite" class="hidden fixed bottom-20 left-5 right-5 sm:left-auto sm:w-96 z-30 rounded-2xl border border-white/15 bg-[#141c36] p-4 shadow-xl">
  <div class="flex items-start justify-between gap-3"><p id="upt" class="text-sm font-semibold truncate"></p><button id="upc" class="shrink-0 text-xs rounded-full border border-white/25 px-3 py-1 text-white/80 hover:text-white hover:bg-white/10">Cancelar</button></div>
  <div id="upp" class="h-2 rounded-full bg-white/10 overflow-hidden my-3" role="progressbar" aria-label="Progreso de la subida" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="upf" class="h-full grad rounded-full transition-[width] duration-200" style="width:0%"></div></div>
  <p id="upd" class="text-xs text-white/60"></p></div>`);
$('upc').addEventListener('click', () => { UP.cancel = true; if (UP.xhr) UP.xhr.abort(); });

function upShow(title, pct, detail, cancelable = true) {
  clearTimeout(UP.timer);
  $('upbox').classList.remove('hidden');
  $('upt').textContent = title; $('upd').textContent = detail;
  $('upf').style.width = pct + '%'; $('upp').setAttribute('aria-valuenow', Math.round(pct));
  $('upc').classList.toggle('hidden', !cancelable);
}
const upHideLater = ms => { clearTimeout(UP.timer); UP.timer = setTimeout(() => { if (!UP.active) $('upbox').classList.add('hidden'); }, ms); };

const sendChunk = (url, blob, onProg) => new Promise(res => {
  const x = new XMLHttpRequest(); UP.xhr = x;
  x.open('POST', url);
  x.upload.onprogress = e => onProg(e.loaded);
  x.onload = () => { let r = {}; try { r = JSON.parse(x.responseText); } catch (e) { } res({ status: x.status, json: r }); };
  x.onerror = x.ontimeout = x.onabort = () => res({ status: 0, json: {} });
  x.send(blob);
});

async function uploadOne(f, dest, onProg) {
  const qs = (o = {}) => new URLSearchParams({ drive: dest.drive, path: dest.path, name: f.name, key: upKey(f), size: f.size, ...o });
  const remote = async () => { // cuánto ya tiene el servidor (permite reanudar)
    try { const r = await fetch('/api/files/upload/status?' + qs(), { cache: 'no-store' }); const n = (await r.json()).size || 0; return n <= f.size ? n : 0; } catch (e) { return 0; }
  };
  let off = await remote(), fails = 0;
  const start = off;
  onProg(off, start);
  while (true) {
    if (UP.cancel) throw new Error('cancelado');
    const end = Math.min(off + CHUNK, f.size);
    const r = await sendChunk('/api/files/upload/chunk?' + qs({ offset: off }), f.slice(off, end), l => onProg(off + l, start));
    if (r.status === 200) {
      fails = 0;
      if (r.json.done) { onProg(f.size, start); return; }
      off = r.json.received ?? end; onProg(off, start);
    } else if (r.status === 409) off = r.json.size || 0;
    else if (UP.cancel) throw new Error('cancelado');
    else if (r.status === 0 || (r.status >= 500 && r.status !== 507)) {
      if (++fails > 8) throw new Error('Se perdió la conexión con el servidor');
      onProg(off, start, `Sin conexión. Reintentando (${fails}/8)…`);
      await sleep(Math.min(20000, 1000 * 2 ** fails));
      off = await remote();
    } else throw new Error(r.json.error || 'El servidor rechazó la subida');
  }
}

async function uploadFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  if (UP.active) return toast('Ya hay una subida en curso.');
  const dest = { drive: curDrive(), path: cwd }, total = files.reduce((a, f) => a + f.size, 0);
  let done = 0, resumed = 0, lastStart = 0, ok = 0, failed = null, pct = 0;
  UP.active = true; UP.cancel = false;
  try { UP.lock = await navigator.wakeLock?.request('screen'); } catch (e) { UP.lock = null; } // pantalla encendida (solo con HTTPS)
  const t0 = Date.now();
  for (let i = 0; i < files.length && !failed; i++) {
    const f = files[i];
    try {
      await uploadOne(f, dest, (cur, start, note) => {
        lastStart = start;
        const sent = done + cur, el = (Date.now() - t0) / 1000;
        const speed = el > 1 ? Math.max(0, (done - resumed) + (cur - start)) / el : 0;
        pct = total ? sent / total * 100 : 100;
        const eta = speed > 0 ? (total - sent) / speed : 0;
        upShow(`Subiendo ${files.length > 1 ? `${i + 1} de ${files.length}: ` : ''}${f.name}`, pct,
          note || `${fmt(sent)} de ${fmt(total)} · ${Math.round(pct)} %` + (speed ? ` · ${fmt(speed)}/s` : '') + (eta ? ` · quedan ${fmtEta(eta)}` : ''));
      });
      done += f.size; resumed += lastStart; ok++;
    } catch (e) {
      failed = e;
      if (UP.cancel) await fetch('/api/files/upload/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drive: dest.drive, path: dest.path, name: f.name, key: upKey(f) }) }).catch(() => { });
    }
  }
  UP.active = false; UP.xhr = null;
  try { if (UP.lock) UP.lock.release(); } catch (e) { }
  UP.lock = null;
  if (failed && UP.cancel) { upShow('Subida cancelada', pct, ok ? `${ok} archivo(s) ya se subieron.` : '', false); upHideLater(3000); }
  else if (failed) { upShow('La subida se interrumpió', pct, `${failed.message}. Vuelve a elegir el archivo y continuará donde quedó.`, false); upHideLater(20000); }
  else { upShow('Subida completada', 100, `${ok} archivo${ok > 1 ? 's' : ''} · ${fmt(total)}`, false); upHideLater(4000); }
  if (isFiles()) loadFiles();
}

/* ---------- Delegación de Eventos ---------- */
/* ---------- Visor de imágenes y videos ---------- */
document.head.insertAdjacentHTML('beforeend', '<style>#vbox:fullscreen{max-width:none;max-height:none;height:100%;border-radius:0;border:0}#vbox:fullscreen video{max-height:none;height:calc(100vh - 7rem)}#vbox:fullscreen img{max-height:calc(100vh - 6rem)}</style>');
let VW = null;
const VB = 'relative shrink-0 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10';
const mediaUrl = p => `/api/files/stream?drive=${encodeURIComponent(curDrive())}&path=${encodeURIComponent(p)}`;
const fmtT = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), c = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(c).padStart(2, '0'); };
const tag10 = '<span class="absolute inset-0 grid place-items-center text-[9px] font-bold pointer-events-none">10</span>';

function closeViewer() {
  if (!VW) return;
  const v = VW.ov.querySelector('video');
  if (v) { v.pause(); v.removeAttribute('src'); v.load(); } // corta la descarga en curso
  if (document.fullscreenElement) document.exitFullscreen();
  document.removeEventListener('keydown', VW.key);
  document.body.style.overflow = '';
  VW.ov.remove();
  if (VW.opener && VW.opener.isConnected) VW.opener.focus();
  VW = null;
}

function setupVideo(ov, toggleFs) {
  const q = s => ov.querySelector(s), v = q('video'), pp = q('[data-pp]'), sk = q('[data-seek]');
  const skip = d => { if (v.duration) v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + d)); };
  const toggle = () => v.paused ? v.play().catch(() => {}) : v.pause();
  const icon = () => pp.innerHTML = ic(v.paused ? I.play : I.pause, 'w-6 h-6');
  let seeking = false;
  icon();
  ['play', 'pause', 'ended'].forEach(ev => v.addEventListener(ev, icon));
  v.addEventListener('loadedmetadata', () => q('[data-dur]').textContent = fmtT(v.duration));
  v.addEventListener('timeupdate', () => { q('[data-cur]').textContent = fmtT(v.currentTime); if (!seeking && v.duration) sk.value = v.currentTime / v.duration * 1000; });
  v.addEventListener('error', () => { const m = q('[data-err]'); m.textContent = 'Este navegador no puede reproducir este video. Prueba con MP4 (H.264) o WebM.'; m.classList.remove('hidden'); });
  sk.addEventListener('input', () => { seeking = true; if (v.duration) v.currentTime = sk.value / 1000 * v.duration; });
  sk.addEventListener('change', () => seeking = false);
  q('[data-b10]').onclick = () => skip(-10);
  q('[data-f10]').onclick = () => skip(10);
  pp.onclick = v.onclick = toggle;
  v.ondblclick = toggleFs;
  v.play().catch(() => {});
  return e => {
    const free = !['BUTTON', 'INPUT'].includes(e.target.tagName);
    if (e.key === ' ' && free) { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowLeft' && e.target.tagName !== 'INPUT') skip(-10);
    else if (e.key === 'ArrowRight' && e.target.tagName !== 'INPUT') skip(10);
  };
}

function setupImage(ov) {
  const q = s => ov.querySelector(s), img = q('[data-img]'), wrap = q('[data-wrap]'), lab = q('[data-zl]');
  let sc = 1, tx = 0, ty = 0, drag = null;
  const apply = () => {
    if (sc <= 1) tx = ty = 0;
    img.style.transform = `translate(${tx}px,${ty}px) scale(${sc})`;
    lab.textContent = Math.round(sc * 100) + '%';
    wrap.style.cursor = drag ? 'grabbing' : sc > 1 ? 'grab' : 'default';
  };
  const zoom = f => { sc = Math.min(8, Math.max(1, sc * f)); apply(); };
  q('[data-zi]').onclick = () => zoom(1.25);
  q('[data-zo]').onclick = () => zoom(0.8);
  lab.onclick = () => { sc = 1; apply(); };
  wrap.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  img.addEventListener('dblclick', () => { sc = sc > 1 ? 1 : 2.5; apply(); });
  wrap.addEventListener('pointerdown', e => { if (sc > 1) { drag = { x: e.clientX - tx, y: e.clientY - ty }; wrap.setPointerCapture(e.pointerId); apply(); } });
  wrap.addEventListener('pointermove', e => { if (drag) { tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); } });
  wrap.addEventListener('pointerup', () => { drag = null; apply(); });
  img.addEventListener('error', () => { const m = q('[data-err]'); m.textContent = 'No se pudo cargar la imagen.'; m.classList.remove('hidden'); });
  return e => {
    if (e.key === '+' || e.key === '=') zoom(1.25);
    else if (e.key === '-') zoom(0.8);
    else if (e.key === '0') { sc = 1; apply(); }
  };
}

function openViewer(x) {
  closeViewer();
  const isVid = x.t === 'vid', opener = document.activeElement, url = mediaUrl(x.p);
  const ov = document.createElement('div');
  ov.className = 'fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', x.n);
  const fsBtn = `<button data-fs class="${VB}" aria-label="Pantalla completa" title="Pantalla completa (F)">${ic(I.expand, 'w-5 h-5')}</button>`;
  const xBtn = `<button data-vx class="${VB}" aria-label="Cerrar" title="Cerrar (Esc)">${ic(I.close, 'w-6 h-6')}</button>`;
  const err = '<p data-err class="hidden absolute inset-0 grid place-items-center p-6 text-center text-white/80 bg-black/70"></p>';
  const zoomBtns = `<button data-zo class="${VB}" aria-label="Alejar" title="Alejar (-)">${ic(I.zout, 'w-5 h-5')}</button><button data-zl class="px-2 text-sm tabular-nums text-white/80 hover:text-white" title="Restablecer zoom (0)">100%</button><button data-zi class="${VB}" aria-label="Acercar" title="Acercar (+)">${ic(I.zin, 'w-5 h-5')}</button>`;
  ov.innerHTML = `<div id="vbox" class="w-full max-w-5xl max-h-full flex flex-col rounded-2xl border border-white/10 bg-[#0f1528] overflow-hidden">
    <div class="flex items-center gap-1 px-4 py-2"><span class="font-semibold truncate flex-1 mr-2">${esc(x.n)}</span>${isVid ? '' : zoomBtns + fsBtn}${xBtn}</div>`
    + (isVid
      ? `<div class="relative flex-1 min-h-0 bg-black flex items-center justify-center"><video src="${url}" preload="metadata" playsinline class="w-full max-h-[70vh] cursor-pointer"></video>${err}</div>
         <div class="flex items-center gap-1 px-3 py-2">
           <button data-b10 class="${VB}" aria-label="Retroceder 10 segundos" title="Retroceder 10 s (←)">${ic(I.rew, 'w-6 h-6')}${tag10}</button>
           <button data-pp class="${VB}" aria-label="Reproducir o pausar" title="Reproducir / pausar (Espacio)"></button>
           <button data-f10 class="${VB}" aria-label="Adelantar 10 segundos" title="Adelantar 10 s (→)">${ic(I.ff, 'w-6 h-6')}${tag10}</button>
           <span data-cur class="w-12 text-center text-xs tabular-nums text-white/70">0:00</span>
           <input data-seek type="range" min="0" max="1000" step="1" value="0" aria-label="Progreso del video" class="flex-1 min-w-0 accent-pink-500">
           <span data-dur class="w-12 text-center text-xs tabular-nums text-white/70">0:00</span>${fsBtn}
         </div>`
      : `<div data-wrap class="relative flex-1 min-h-0 bg-black/60 overflow-hidden flex items-center justify-center touch-none"><img data-img src="${url}" alt="${esc(x.n)}" draggable="false" class="max-w-full max-h-[78vh] object-contain select-none">${err}</div>`)
    + '</div>';
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  const box = ov.firstElementChild;
  const toggleFs = () => document.fullscreenElement ? document.exitFullscreen()
    : box.requestFullscreen ? box.requestFullscreen() : ov.querySelector('video')?.webkitEnterFullscreen?.();
  const onKey = isVid ? setupVideo(ov, toggleFs) : setupImage(ov);
  const key = e => {
    if (e.key === 'Escape' && !document.fullscreenElement) closeViewer();
    else if (e.key === 'f' || e.key === 'F') toggleFs();
    else onKey(e);
  };
  ov.querySelector('[data-fs]').onclick = toggleFs;
  ov.querySelector('[data-vx]').onclick = closeViewer;
  ov.addEventListener('click', e => { if (e.target === ov) closeViewer(); });
  document.addEventListener('keydown', key);
  VW = { ov, key, opener };
  ov.querySelector('[data-vx]').focus();
}

function openItem(p) {
  const x = SERVER_FILES.find(y => y.p === p);
  if (!x || view === 'papelera') return;
  if (x.t === 'dir') navTo({ view: isDrv() ? 'unidades' : 'inicio', cwd: x.p, drv: isDrv() ? drv : null, dn: isDrv() ? drvName : '' });
  else if (x.t === 'img' || x.t === 'vid') openViewer(x);
  else toast('Este tipo de archivo no tiene vista previa.');
}
document.addEventListener('dblclick', e => {
  const r = e.target.closest('.row[data-p]');
  if (r && !e.target.closest('button,input')) openItem(r.dataset.p);
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-v],[data-go],[data-act],[data-pf],[data-fav],[data-drv],[data-open]');
  if (!b) return;
  const d = b.dataset;
  if (d.v) setView(d.v);
  else if (d.pf) { PF.tab = d.pf; $('view').innerHTML = perf(); drawPerf(); $('view').querySelector('[aria-selected=true]').focus(); }
  else if (d.go) navTo({ view: isDrv() ? 'unidades' : 'inicio', cwd: d.go, drv: isDrv() ? drv : null, dn: isDrv() ? drvName : '' });
  else if (d.drv) { const x = SERVER_FILES.find(y => y.id === d.drv); if (x) navTo({ view: 'unidades', cwd: '/', drv: x.id, dn: x.name }); }
  else if (d.act) run(d.act);
  else if (d.fav) toggleFav(d.fav);
  else if (d.open) openItem(d.open);
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.sel) {
    const path = t.dataset.sel;
    t.checked ? sel.add(path) : sel.delete(path);
    t.closest('.row').classList.toggle('on', t.checked);
    sync();
  } else if (t.id === 'all') {
    items().forEach(x => t.checked ? sel.add(x.p) : sel.delete(x.p));
    document.querySelectorAll('[data-sel]').forEach(c => { c.checked = t.checked; c.closest('.row').classList.toggle('on', t.checked); });
    sync();
  } else if (t.id === 'up' && t.files.length) {
    uploadFiles(t.files);
    t.value = '';
  }
});

$('q').addEventListener('input', e => { q = e.target.value; sel.clear(); $('view').innerHTML = body(); sync(); });
$('tog').addEventListener('click', () => {
  if (innerWidth < 768) { $('side').classList.toggle('open'); $('scrim').classList.toggle('hidden'); }
  else $('side').classList.toggle('collapsed');
});
$('scrim').addEventListener('click', () => { $('side').classList.remove('open'); $('scrim').classList.add('hidden'); });

/* ---------- Inicialización ---------- */
$('rail').innerHTML = RAIL.map(([v, l, i]) => `<button class="tile" data-v="${v}" title="${l}" aria-label="${l}">${ic(I[i], 'w-7 h-7')}</button>`).join('');
$('menu').innerHTML = MENU.map(([v, l]) => `<button class="mi" data-v="${v}">${l}</button>`).join('');
$('tog').innerHTML = ic(I.panel, 'w-6 h-6');
$('back').innerHTML = ic(I.back, 'w-6 h-6');
$('fwd').innerHTML = ic(I.fwd, 'w-6 h-6');
$('back').addEventListener('click', () => { if (hpos > 0) navTo(HIST[--hpos], false); });
$('fwd').addEventListener('click', () => { if (hpos < HIST.length - 1) navTo(HIST[++hpos], false); });

// Detecta unidades nuevas (USB, discos externos) mientras se ve la lista
setInterval(async () => {
  if (view !== 'unidades' || drv) return;
  try {
    const r = await fetch('/api/drives', { cache: 'no-store' });
    const items = (await r.json()).items || [];
    if (view === 'unidades' && !drv && JSON.stringify(items) !== JSON.stringify(SERVER_FILES)) { SERVER_FILES = items; render(); }
  } catch (e) { /* se reintenta en el siguiente ciclo */ }
}, 5000);

// Carga inicial
navTo(here());
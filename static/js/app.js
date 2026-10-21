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
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>'
};

/* ---------- Estado y variables globales ---------- */
let view = 'inicio', cwd = '/', q = '';
let SERVER_FILES = [];
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
  inicio: { t: 'Inicio', a: ['crear', 'copiar', 'subir', 'mover', 'eliminar'] },
  favoritos: { t: 'Favoritos', a: ['quitar'] },
  imagenes: { t: 'Imágenes', a: ['copiar', 'eliminar'] },
  videos: { t: 'Videos', a: ['copiar', 'eliminar'] },
  recientes: { t: 'Recientes', a: ['copiar', 'eliminar'] },
  todos: { t: 'Todos los archivos', a: ['copiar', 'eliminar'] },
  papelera: { t: 'Papelera', k: 'trash', a: ['restaurar', 'vaciar'] },
  rendimiento: { t: 'Rendimiento', k: 'perf' },
  unidades: { t: 'Unidades de almacenamiento', k: 'disks' }
};
const ACT = {
  crear: ['Crear', I.plus, 0], copiar: ['Copiar', I.copy, 1], subir: ['Subir', I.up, 0], mover: ['Mover', I.move, 1],
  eliminar: ['Eliminar', I.trash, 1], agregar: ['Agregar', I.plus, 0], quitar: ['Eliminar de Favoritos', I.trash, 1],
  restaurar: ['Restaurar', I.undo, 1], vaciar: ['Vaciar papelera', I.trash, 0]
};

/* ---------- Cargar Archivos desde el Backend ---------- */
async function loadFiles() {
  try {
    const res = await fetch(`/api/files/list?path=${encodeURIComponent(cwd)}`);
    if (!res.ok) throw new Error('Error al leer archivos');
    const data = await res.json();
    SERVER_FILES = data.items || [];
    render();
  } catch (err) {
    SERVER_FILES = [];
    render();
    toast('No se pudieron cargar los archivos del servidor');
  }
}

function items() {
  let a = SERVER_FILES;
  if (view === 'imagenes') a = a.filter(x => x.t === 'img');
  else if (view === 'videos') a = a.filter(x => x.t === 'vid');
  
  const s = q.trim().toLowerCase();
  return s ? a.filter(x => x.n.toLowerCase().includes(s)) : a;
}

/* ---------- Renderizado de la Tabla ---------- */
function rowHtml(x) {
  const name = x.t === 'dir'
    ? `<button class="truncate text-left hover:underline font-medium" data-go="${esc(x.p)}">${esc(x.n)}</button>`
    : `<span class="truncate">${esc(x.n)}</span>`;
  
  return `<div class="row ${sel.has(x.p) ? 'on' : ''}">
    <input type="checkbox" data-sel="${esc(x.p)}" ${sel.has(x.p) ? 'checked' : ''} aria-label="Seleccionar ${esc(x.n)}">
    <div class="flex items-center gap-2 min-w-0">${ic(I[x.t] || I.doc)}${name}</div>
    <span class="hidden md:block text-white/90">${fd(x.d)}</span>
    <span class="text-white/90">${x.t === 'dir' ? '--' : fmt(x.s)}</span></div>`;
}

function table(l) {
  if (!l.length) {
    const m = q ? `Ningún resultado para “${esc(q)}”.` : 'Esta carpeta está vacía. Usa Crear o Subir para añadir contenido.';
    return `<p class="py-10 text-white/60">${m}</p>`;
  }
  return `<div class="row text-white/60 border-t border-white/30 rounded-none"><input id="all" type="checkbox" aria-label="Seleccionar todo"><span>Nombre</span><span class="hidden md:block">Fecha de modificación</span><span>Tamaño</span></div>` + l.map(rowHtml).join('');
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
function perfStop() { if (PF.timer) { clearInterval(PF.timer); PF.timer = null; } }

const perf = () => `<div class="flex gap-2 mb-6">${PF_TABS.map(([k, l]) => `<button data-pf="${k}" class="px-4 py-1.5 rounded-full ${PF.tab === k ? 'bg-[#1b2a5c] text-white' : 'text-white/60'}">${l}</button>`).join('')}</div><div id="pf"></div>`;

function body() {
  const k = VIEWS[view].k;
  return k === 'perf' ? perf() : table(items());
}

const crumbs = () => {
  const rel = cwd.split('/').filter(Boolean);
  let p = '';
  return `<button class="hover:underline" data-go="/">root</button>` + rel.map(s => { p += '/' + s; return ` / <button class="hover:underline" data-go="${esc(p)}">${esc(s)}</button>`; }).join('');
};

function sync() {
  const n = sel.size;
  $('count').textContent = `Seleccionados: ${n} elemento${n === 1 ? '' : 's'}`;
  document.querySelectorAll('[data-need]').forEach(b => b.disabled = !n);
}

function render() {
  const v = VIEWS[view], files = !v.k;
  $('title').textContent = v.t;
  $('path').innerHTML = view === 'inicio' ? crumbs() : '';
  $('acts').innerHTML = (v.a || []).map(a => { const [l, i, n] = ACT[a]; return `<button class="pill" data-act="${a}" ${n ? 'data-need disabled' : ''}>${ic(i, 'w-4 h-4')}${l}</button>`; }).join('');
  $('view').innerHTML = body();
  view === 'rendimiento' ? perfStart() : perfStop();
  sync();
}

function setView(v) {
  view = v; sel.clear(); q = ''; $('q').value = '';
  if (v === 'inicio') loadFiles();
  else render();
}

/* ---------- Acciones Reales contra la API de Flask ---------- */
async function run(a) {
  if (a === 'subir') return $('up').click();
  
  if (a === 'crear') {
    const nm = prompt('Nombre de la nueva carpeta:');
    if (!nm || !nm.trim()) return;
    try {
      const res = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: cwd, name: nm.trim() })
      });
      if (res.ok) { toast('Carpeta creada'); loadFiles(); }
      else toast('Error al crear la carpeta');
    } catch (e) { toast('Error de conexión'); }
  } 
  else if (a === 'eliminar') {
    if (!confirm(`¿Eliminar ${sel.size} elemento(s)?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: Array.from(sel) })
      });
      if (res.ok) { toast('Eliminado con éxito'); sel.clear(); loadFiles(); }
      else toast('Error al eliminar');
    } catch (e) { toast('Error de conexión'); }
  }
  else if (a === 'copiar') {
    try {
      const res = await fetch('/api/files/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: Array.from(sel) })
      });
      if (res.ok) { toast('Copia creada'); sel.clear(); loadFiles(); }
      else toast('Error al copiar');
    } catch (e) { toast('Error de conexión'); }
  }
}

async function uploadFiles(filesList) {
  const formData = new FormData();
  formData.append('path', cwd);
  for (let i = 0; i < filesList.length; i++) {
    formData.append('files', filesList[i]);
  }
  toast('Subiendo archivo(s)...');
  try {
    const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
    if (res.ok) { toast('Subida completada'); loadFiles(); }
    else toast('Error al subir');
  } catch (e) { toast('Error de red al subir'); }
}

/* ---------- Delegación de Eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-v],[data-go],[data-act],[data-pf]');
  if (!b) return;
  const d = b.dataset;
  if (d.v) setView(d.v);
  else if (d.pf) { PF.tab = d.pf; drawPerf(); }
  else if (d.go) { cwd = d.go; sel.clear(); loadFiles(); }
  else if (d.act) run(d.act);
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.sel) {
    const path = t.dataset.sel;
    t.checked ? sel.add(path) : sel.delete(path);
    t.closest('.row').classList.toggle('on', t.checked);
    sync();
  } else if (t.id === 'all') {
    SERVER_FILES.forEach(x => t.checked ? sel.add(x.p) : sel.delete(x.p));
    document.querySelectorAll('[data-sel]').forEach(c => { c.checked = t.checked; c.closest('.row').classList.toggle('on', t.checked); });
    sync();
  } else if (t.id === 'up' && t.files.length) {
    uploadFiles(t.files);
    t.value = '';
  }
});

$('q').addEventListener('input', e => { q = e.target.value; render(); });

/* ---------- Inicialización ---------- */
$('rail').innerHTML = RAIL.map(([v, l, i]) => `<button class="tile" data-v="${v}" title="${l}">${ic(I[i], 'w-7 h-7')}</button>`).join('');
$('menu').innerHTML = MENU.map(([v, l]) => `<button class="mi" data-v="${v}">${l}</button>`).join('');
$('tog').innerHTML = ic(I.panel, 'w-6 h-6');

// Carga inicial
loadFiles();
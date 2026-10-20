/* Prototipo de interfaz: datos de ejemplo en memoria.
   Cuando exista el backend, sustituye FILES/TRASH/P/DISKS/SVC por fetch('/api/...'). */
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

/* ---------- Datos de ejemplo ---------- */
const ROOT = '/home/usuario';
let nid = 100;
const today = () => new Date().toISOString().slice(0, 10);
const f = (id, n, t, s, o = {}) => ({ id, n, t, s, p: ROOT, fav: 0, d: '2026-01-01', ...o });
const FILES = [
  f(1, 'Carpeta 1', 'dir', 3e9, { fav: 1 }), f(2, 'Carpeta 2', 'dir', 3e9), f(3, 'Carpeta 3', 'dir', 3e9),
  f(4, 'Archivo 1.txt', 'doc', 4e5), f(5, 'Archivo 2.pdf', 'doc', 4e5, { d: '2026-02-14' }),
  f(6, 'Imagen 1.jpg', 'img', 1.5e8), f(7, 'Imagen 2.png', 'img', 1e8, { d: '2026-03-02' }),
  f(8, 'Video 1.mp4', 'vid', 7e8), f(9, 'Video 2.mkv', 'vid', 5e8, { d: '2026-03-20' }),
  f(10, 'Notas.txt', 'doc', 2e3, { p: ROOT + '/Carpeta 1', d: '2026-04-05' })
];
const TRASH = [];
const P = { cpu: 23, ram: 6.4, temp: 48 };
const DISKS = [
  { dev: '/dev/sda1', mp: '/', fs: 'ext4', total: 5e11, used: 2.1e11 },
  { dev: '/dev/sdb1', mp: '/mnt/externo', fs: 'ntfs', total: 2e12, used: 1.75e12 },
  { dev: '/dev/sdc1', mp: '/media/usb', fs: 'vfat', total: 6.4e10, used: 1.2e10 }
];
const SVC = [['Panel NAS', 'nas-dashboard', 1], ['Docker', 'docker', 1], ['SSH', 'sshd', 1], ['Samba', 'smbd', 0]];

/* ---------- Configuración de vistas ---------- */
const RAIL = [['inicio', 'Inicio', 'home'], ['favoritos', 'Favoritos', 'star'], ['imagenes', 'Imágenes', 'img'], ['videos', 'Videos', 'vid']];
const MENU = [['recientes', 'Recientes'], ['todos', 'Todos los archivos/carpetas'], ['rendimiento', 'Rendimiento'], ['papelera', 'Papelera'], ['servicios', 'Servicios instalados'], ['unidades', 'Unidades de almacenamiento']];
const VIEWS = {
  inicio: { t: 'Inicio', a: ['crear', 'copiar', 'subir', 'mover', 'eliminar'] },
  favoritos: { t: 'Favoritos', a: ['agregar', 'quitar'] },
  imagenes: { t: 'Imágenes', a: ['copiar', 'eliminar'] },
  videos: { t: 'Videos', a: ['copiar', 'eliminar'] },
  recientes: { t: 'Recientes', a: ['copiar', 'mover', 'eliminar'] },
  todos: { t: 'Todos los archivos', a: ['copiar', 'mover', 'eliminar'] },
  papelera: { t: 'Papelera', k: 'trash', a: ['restaurar', 'vaciar'] },
  rendimiento: { t: 'Rendimiento', k: 'perf' },
  servicios: { t: 'Servicios instalados', k: 'svc' },
  unidades: { t: 'Unidades de almacenamiento', k: 'disks' }
};
// [etiqueta, icono, requiere selección]
const ACT = {
  crear: ['Crear', I.plus, 0], copiar: ['Copiar', I.copy, 1], subir: ['Subir', I.up, 0], mover: ['Mover', I.move, 1],
  eliminar: ['Eliminar', I.trash, 1], agregar: ['Agregar', I.plus, 0], quitar: ['Eliminar de Favoritos', I.trash, 1],
  restaurar: ['Restaurar', I.undo, 1], vaciar: ['Vaciar papelera', I.trash, 0]
};

/* ---------- Estado y utilidades ---------- */
let view = 'inicio', cwd = ROOT, q = '';
const sel = new Set();
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fd = d => d.split('-').reverse().join('/');
const fmt = b => { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1000 && i < 4) { b /= 1000; i++; } return (i ? +b.toFixed(b < 10 ? 1 : 0) : b) + ' ' + u[i]; };
const tp = fl => fl.type.startsWith('image') ? 'img' : fl.type.startsWith('video') ? 'vid' : 'doc';
const bar = p => `<div class="h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}"><div class="h-full rounded-full ${p > 85 ? 'bg-red-500' : 'grad'}" style="width:${p}%"></div></div>`;
let tt;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(tt); tt = setTimeout(() => t.classList.add('hidden'), 2800); }

function items() {
  let a = FILES;
  if (view === 'inicio') a = a.filter(x => x.p === cwd);
  else if (view === 'favoritos') a = a.filter(x => x.fav);
  else if (view === 'imagenes') a = a.filter(x => x.t === 'img');
  else if (view === 'videos') a = a.filter(x => x.t === 'vid');
  else if (view === 'recientes') a = [...a].sort((x, y) => y.d.localeCompare(x.d)).slice(0, 10);
  if (view === 'inicio' || view === 'todos') a = [...a].sort((x, y) => (y.t === 'dir') - (x.t === 'dir'));
  const s = q.trim().toLowerCase();
  return s ? a.filter(x => x.n.toLowerCase().includes(s)) : a;
}
const cur = () => view === 'papelera' ? TRASH : items();

/* ---------- Vistas ---------- */
function rowHtml(x) {
  const name = x.t === 'dir'
    ? `<button class="truncate text-left hover:underline" data-go="${esc(x.p + '/' + x.n)}">${esc(x.n)}</button>`
    : `<span class="truncate">${esc(x.n)}</span>`;
  const star = view === 'papelera' ? '' : `<button data-fav="${x.id}" class="${x.fav ? 'text-yellow-300' : 'text-white/30 hover:text-white'}" aria-label="${x.fav ? 'Quitar de favoritos' : 'Marcar como favorito'}: ${esc(x.n)}">${ic(I.star, 'w-4 h-4' + (x.fav ? ' fill-current' : ''))}</button>`;
  return `<div class="row ${sel.has(x.id) ? 'on' : ''}">
    <input type="checkbox" data-sel="${x.id}" ${sel.has(x.id) ? 'checked' : ''} aria-label="Seleccionar ${esc(x.n)}">
    <div class="flex items-center gap-2 min-w-0">${ic(I[x.t])}${name}${star}</div>
    <span class="hidden md:block text-white/90">${fd(x.d)}</span>
    <span class="text-white/90">${fmt(x.s)}</span></div>`;
}
function table(l) {
  if (!l.length) {
    const m = q ? `Ningún resultado para “${esc(q)}”.` : view === 'papelera' ? 'La papelera está vacía.'
      : view === 'favoritos' ? 'Aún no tienes favoritos. Marca la estrella junto a cualquier archivo o carpeta.'
      : view === 'inicio' ? 'Esta carpeta está vacía. Usa Crear o Subir para añadir contenido.'
      : 'No hay elementos que mostrar aquí.';
    return `<p class="py-10 text-white/60">${m}</p>`;
  }
  return `<div class="row text-white/60 border-t border-white/30 rounded-none"><input id="all" type="checkbox" aria-label="Seleccionar todo"><span>Nombre</span><span class="hidden md:block">Fecha de modificación</span><span>Tamaño</span></div>` + l.map(rowHtml).join('');
}
const line = (l, r, extra = '') => `<div class="py-5 border-b border-white/10"><div class="flex justify-between gap-4 ${extra ? 'mb-2' : ''}"><span>${l}</span><span class="text-white/70 text-right">${r}</span></div>${extra}</div>`;
const perf = () => line('Procesador', P.cpu + ' %', bar(P.cpu)) + line('Memoria RAM', P.ram.toFixed(1) + ' GB de 16 GB', bar(P.ram / 16 * 100)) + line('Temperatura', P.temp + ' °C', bar(P.temp))
  + '<p class="text-sm text-white/50 mt-4">Datos de ejemplo. Aquí se mostrarán los de /api/system-stats.</p>';
const disks = () => DISKS.map(d => line(`${d.mp} <span class="text-white/50 text-sm">${d.dev} · ${d.fs}</span>`, `${fmt(d.used)} de ${fmt(d.total)} (${Math.round(d.used / d.total * 100)} %)`, bar(d.used / d.total * 100))).join('');
const svc = () => SVC.map(([n, u, on]) => line(`${n} <span class="text-white/50 text-sm">${u}</span>`, `<span class="inline-flex items-center gap-2"><span class="w-2 h-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-white/40'}"></span>${on ? 'Activo' : 'Detenido'}</span>`)).join('');
function body() {
  const k = VIEWS[view].k;
  return k === 'perf' ? perf() : k === 'svc' ? svc() : k === 'disks' ? disks() : table(cur());
}
const crumbs = () => {
  let p = ROOT;
  const rel = cwd.slice(ROOT.length).split('/').filter(Boolean);
  return `<button class="hover:underline" data-go="${ROOT}">${ROOT}</button>` + rel.map(s => { p += '/' + s; return ` / <button class="hover:underline" data-go="${esc(p)}">${esc(s)}</button>`; }).join('');
};

function sync() {
  const n = sel.size;
  $('count').textContent = `Seleccionados: ${n} elemento${n === 1 ? '' : 's'}`;
  document.querySelectorAll('[data-need]').forEach(b => b.disabled = !n);
  const all = $('all');
  if (all) { const ids = cur().map(x => x.id); all.checked = ids.length > 0 && ids.every(i => sel.has(i)); }
}
function render() {
  const v = VIEWS[view], files = !v.k || v.k === 'trash';
  $('title').textContent = v.t;
  document.title = v.t + ' - NAS Dashboard';
  $('path').innerHTML = view === 'inicio' ? crumbs() : '';
  $('acts').innerHTML = (v.a || []).map(a => { const [l, i, n] = ACT[a]; return `<button class="pill" data-act="${a}" ${n ? 'data-need disabled' : ''}>${ic(i, 'w-4 h-4')}${l}</button>`; }).join('');
  $('q').classList.toggle('hidden', !files);
  $('count').classList.toggle('hidden', !files);
  $('view').innerHTML = body();
  document.querySelectorAll('[data-v]').forEach(b => {
    const on = b.dataset.v === view;
    b.classList.toggle('on', on);
    on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  sync();
}
function setView(v) {
  view = v; sel.clear(); q = ''; $('q').value = '';
  $('side').classList.remove('open'); $('scrim').classList.add('hidden');
  render();
}

/* ---------- Acciones (simuladas) ---------- */
function run(a) {
  const pk = L => L.filter(x => sel.has(x.id)), n = sel.size;
  if (a === 'subir') return $('up').click();
  if (a === 'agregar') return toast('Marca la estrella junto a un archivo para añadirlo a Favoritos.');
  if (a === 'mover') return toast('Mover se conectará al backend de Flask.');
  if (a === 'crear') {
    const nm = prompt('Nombre de la carpeta nueva');
    if (!nm || !nm.trim()) return;
    FILES.push(f(++nid, nm.trim(), 'dir', 0, { p: cwd, d: today() })); toast('Carpeta creada');
  } else if (a === 'copiar') {
    pk(FILES).forEach(x => FILES.push({ ...x, id: ++nid, fav: 0, n: x.n.replace(/(\.\w+)?$/, ' (copia)$1'), d: today() })); toast('Copia creada');
  } else if (a === 'eliminar') {
    pk(FILES).forEach(x => { FILES.splice(FILES.indexOf(x), 1); TRASH.push(x); });
    toast(`Movido a la papelera: ${n} elemento${n > 1 ? 's' : ''}`);
  } else if (a === 'quitar') {
    pk(FILES).forEach(x => x.fav = 0); toast('Eliminado de Favoritos');
  } else if (a === 'restaurar') {
    pk(TRASH).forEach(x => { TRASH.splice(TRASH.indexOf(x), 1); FILES.push(x); }); toast('Restaurado');
  } else if (a === 'vaciar') {
    if (!TRASH.length || !confirm('¿Eliminar definitivamente todo lo que hay en la papelera?')) return;
    TRASH.length = 0; toast('Papelera vaciada');
  }
  sel.clear(); render();
}

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-v],[data-go],[data-act],[data-fav]');
  if (!b) return;
  const d = b.dataset;
  if (d.v) setView(d.v);
  else if (d.go) { view = 'inicio'; cwd = d.go; sel.clear(); q = ''; $('q').value = ''; render(); }
  else if (d.act) run(d.act);
  else if (d.fav) { const x = FILES.find(y => y.id == d.fav); x.fav = x.fav ? 0 : 1; render(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.sel) {
    const id = +t.dataset.sel;
    t.checked ? sel.add(id) : sel.delete(id);
    t.closest('.row').classList.toggle('on', t.checked); sync();
  } else if (t.id === 'all') {
    cur().forEach(x => t.checked ? sel.add(x.id) : sel.delete(x.id));
    document.querySelectorAll('[data-sel]').forEach(c => { c.checked = t.checked; c.closest('.row').classList.toggle('on', t.checked); });
    sync();
  } else if (t.id === 'up') {
    [...t.files].forEach(fl => FILES.push(f(++nid, fl.name, tp(fl), fl.size, { p: cwd, d: today() })));
    toast(`Subidos: ${t.files.length} archivo${t.files.length > 1 ? 's' : ''} (solo en la vista de ejemplo)`);
    t.value = ''; render();
  }
});
$('q').addEventListener('input', e => { q = e.target.value; sel.clear(); $('view').innerHTML = body(); sync(); });
$('tog').addEventListener('click', () => {
  if (innerWidth < 768) { $('side').classList.toggle('open'); $('scrim').classList.toggle('hidden'); }
  else $('side').classList.toggle('collapsed');
});
$('scrim').addEventListener('click', () => { $('side').classList.remove('open'); $('scrim').classList.add('hidden'); });
setInterval(() => {
  if (view !== 'rendimiento') return;
  P.cpu = Math.max(3, Math.min(95, Math.round(P.cpu + Math.random() * 14 - 7)));
  P.ram = Math.min(15.5, Math.max(4, P.ram + Math.random() * .4 - .2));
  $('view').innerHTML = perf();
}, 2000);

/* ---------- Inicio ---------- */
$('rail').innerHTML = RAIL.map(([v, l, i]) => `<button class="tile" data-v="${v}" title="${l}" aria-label="${l}">${ic(I[i], 'w-7 h-7')}</button>`).join('');
$('menu').innerHTML = MENU.map(([v, l]) => `<button class="mi" data-v="${v}">${l}</button>`).join('');
$('tog').innerHTML = ic(I.panel, 'w-6 h-6');
render();
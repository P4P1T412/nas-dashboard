from flask import Flask, jsonify, render_template, request, send_from_directory, send_file, abort
import psutil
import platform
import socket
import time
import os
import shutil
import json
import uuid
import hashlib
import threading
from pathlib import Path

app = Flask(__name__)

# Directorio raíz base que explorará el NAS dentro del contenedor
# (Te recomiendo montar una carpeta del host aquí con Docker)
STORAGE_ROOT = os.path.abspath(os.environ.get('STORAGE_ROOT', '/app/storage'))
os.makedirs(STORAGE_ROOT, exist_ok=True)

# Papelera y favoritos viven dentro del almacenamiento (carpeta oculta .nas),
# así persisten junto con el volumen y la papelera se mueve sin copiar datos.
META_NAME = '.nas'
META = os.path.join(STORAGE_ROOT, META_NAME)
TRASH_DIR = os.path.join(META, 'trash')
TRASH_DB = os.path.join(META, 'trash.json')
FAV_DB = os.path.join(META, 'favorites.json')
os.makedirs(TRASH_DIR, exist_ok=True)
db_lock = threading.Lock()

def db_load(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def db_save(path, data):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)

# Variables globales para métricas en tiempo real
last_disk_io = None
last_disk_time = time.time()
last_net_io = None
last_net_time = time.time()

def get_cpu_model():
    try:
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                if 'model name' in line:
                    return line.split(':')[1].strip()
    except Exception:
        pass
    return platform.processor() or "Procesador Genérico Linux"

def format_speed(b_per_sec):
    if b_per_sec < 1024:
        return f"{b_per_sec:.1f} B/s"
    elif b_per_sec < 1024 * 1024:
        return f"{b_per_sec / 1024:.1f} KB/s"
    else:
        return f"{b_per_sec / (1024 * 1024):.1f} MB/s"

def get_file_type(filename):
    ext = filename.lower().split('.')[-1]
    if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']:
        return 'img'
    elif ext in ['mp4', 'mkv', 'mov', 'avi', 'webm']:
        return 'vid'
    else:
        return 'doc'

# --- RUTAS DE LA VISTA PRINCIPAL ---

@app.route('/')
def index():
    return render_template('index.html')

# --- APIS DE RENDIMIENTO ---

@app.route('/api/system-stats')
def system_stats():
    cpu_usage = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    partitions = []
    for partition in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(partition.mountpoint)
            partitions.append({
                'device': partition.device,
                'mountpoint': partition.mountpoint,
                'fstype': partition.fstype,
                'total': usage.total,
                'used': usage.used,
                'free': usage.free,
                'percent': usage.percent
            })
        except PermissionError:
            continue
    return jsonify({'cpu': cpu_usage, 'ram_percent': ram.percent, 'ram_total': ram.total, 'ram_used': ram.used, 'partitions': partitions})

@app.route('/api/performance-details')
def performance_details():
    global last_disk_io, last_disk_time, last_net_io, last_net_time
    current_time = time.time()
    
    cpu_usage = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk_root = psutil.disk_usage('/')
    
    current_disk_io = psutil.disk_io_counters()
    read_speed, write_speed = "0 KB/s", "0 KB/s"
    if last_disk_io and current_disk_io:
        dt = current_time - last_disk_time
        if dt > 0:
            read_speed = format_speed((current_disk_io.read_bytes - last_disk_io.read_bytes) / dt)
            write_speed = format_speed((current_disk_io.write_bytes - last_disk_io.write_bytes) / dt)
    last_disk_io, last_disk_time = current_disk_io, current_time

    current_net_io = psutil.net_io_counters()
    send_speed, recv_speed = "0 KB/s", "0 KB/s"
    if last_net_io and current_net_io:
        dt = current_time - last_net_time
        if dt > 0:
            send_speed = format_speed((current_net_io.bytes_sent - last_net_io.bytes_sent) / dt)
            recv_speed = format_speed((current_net_io.bytes_recv - last_net_io.bytes_recv) / dt)
    last_net_io, last_net_time = current_net_io, current_time

    ipv4 = "127.0.0.1"
    for iface, addrs in psutil.net_if_addrs().items():
        if iface.startswith('lo'): continue
        for addr in addrs:
            if addr.family == socket.AF_INET and not addr.address.startswith('127.'):
                ipv4 = addr.address

    return jsonify({
        "cpu": {"usage": cpu_usage, "processes": len(psutil.pids()), "cores_logical": psutil.cpu_count(logical=True), "cores_physical": psutil.cpu_count(logical=False), "frequency_ghz": round(psutil.cpu_freq().current / 1000, 2) if psutil.cpu_freq() else 0, "model": get_cpu_model()},
        "ram": {"percent": ram.percent, "total_gb": round(ram.total / (1024**3), 2), "used_gb": round(ram.used / (1024**3), 2), "free_gb": round(ram.available / (1024**3), 2)},
        "disk": {"total_gb": round(disk_root.total / (1024**3), 2), "used_gb": round(disk_root.used / (1024**3), 2), "free_gb": round(disk_root.free / (1024**3), 2), "percent": disk_root.percent, "read_speed": read_speed, "write_speed": write_speed},
        "network": {"ipv4": ipv4, "ipv6": "", "send_speed": send_speed, "recv_speed": recv_speed}
    })

# --- APIS DE EXPLORADOR DE ARCHIVOS (CRUD) ---

# --- UNIDADES DE ALMACENAMIENTO ---
# Una unidad es cualquier disco/partición montada que no sea del sistema operativo.
# Dentro de Docker solo se ven las montadas en el contenedor: usa
#   -v /media:/media:rslave -v /mnt:/mnt:rslave
SYS_BLOCK = os.environ.get('SYS_BLOCK', '/sys/block')
SYSTEM_DIRS = ('/boot', '/etc', '/proc', '/sys', '/dev', '/snap', '/var', '/usr', '/tmp', '/run')
BASE_DIRS = ('/media', '/mnt', '/run/media')

def _under(path, base):
    return path == base or path.startswith(base.rstrip(os.sep) + os.sep)

def _is_candidate(mp):
    if mp == '/' or mp in BASE_DIRS or not os.path.isdir(mp):
        return False  # los montajes de archivos sueltos (/etc/hosts...) y las carpetas base no son unidades
    return _under(mp, '/run/media') or not any(_under(mp, d) for d in SYSTEM_DIRS)

def detect_drives():
    parts = psutil.disk_partitions(all=False)
    main = max((p for p in parts if _under(STORAGE_ROOT, os.path.normpath(p.mountpoint))),
               key=lambda p: len(p.mountpoint), default=None)
    drives = [{'id': 'sistema', 'name': 'Almacenamiento principal', 'kind': 'sistema', 'root': STORAGE_ROOT,
               'device': main.device if main else '', 'fstype': main.fstype if main else ''}]
    seen = {main.device} if main else set()
    for p in parts:
        mp = os.path.normpath(p.mountpoint)
        if p.device in seen or _under(STORAGE_ROOT, mp) or _under(mp, STORAGE_ROOT) or not _is_candidate(mp):
            continue
        seen.add(p.device)
        drives.append({'id': hashlib.sha1(mp.encode()).hexdigest()[:8], 'name': os.path.basename(mp) or mp,
                       'kind': 'externa', 'root': mp, 'device': p.device, 'fstype': p.fstype})
    return drives

def _read(path):
    try:
        with open(path, 'r') as f:
            return f.read().strip()
    except OSError:
        return ''

def unmounted_devices():
    # Discos/particiones que el kernel ve pero que nadie ha montado (así se avisa en vez de ignorarlos)
    mounted = {os.path.basename(p.device) for p in psutil.disk_partitions(all=True)}
    swaps = {os.path.basename(l.split()[0]) for l in _read('/proc/swaps').splitlines()[1:] if l.strip()}
    out = []
    try:
        disks = sorted(os.listdir(SYS_BLOCK))
    except OSError:
        return out
    for disk in disks:
        if disk.startswith(('loop', 'ram', 'zram', 'sr', 'fd', 'dm-', 'md', 'nbd')):
            continue
        base = os.path.join(SYS_BLOCK, disk)
        parts = sorted(n for n in os.listdir(base) if n.startswith(disk) and os.path.exists(os.path.join(base, n, 'partition'))) or [disk]
        if any(n in mounted for n in parts + [disk]):
            continue  # el disco ya tiene algo montado (p. ej. el del sistema)
        model = _read(os.path.join(base, 'device', 'model'))
        for n in parts:
            path = base if n == disk else os.path.join(base, n)
            size = int(_read(os.path.join(path, 'size')) or 0) * 512
            holders = os.path.join(path, 'holders')
            if size < 64 * 1024 ** 2 or n in swaps or (os.path.isdir(holders) and os.listdir(holders)):
                continue
            out.append({'name': n, 'model': model, 'total': size})
    return out

def drive_root(drive_id):
    if not drive_id or drive_id == 'sistema':
        return STORAGE_ROOT
    return next((d['root'] for d in detect_drives() if d['id'] == drive_id), None)

NO_DRIVE = ({'error': 'Unidad no disponible'}, 404)

@app.route('/api/drives', methods=['GET'])
def drives_list():
    out = []
    for d in detect_drives():
        try:
            u = psutil.disk_usage(d['root'])
        except OSError:
            continue
        out.append({'id': d['id'], 'name': d['name'], 'kind': d['kind'], 'device': d['device'], 'fstype': d['fstype'],
                    'mount': '' if d['kind'] == 'sistema' else d['root'],
                    'total': u.total, 'used': u.used, 'free': u.free, 'percent': u.percent})
    for n in unmounted_devices():
        out.append({'id': 'dev:' + n['name'], 'name': n['name'], 'kind': 'sin_montar', 'device': '/dev/' + n['name'],
                    'model': n['model'], 'fstype': '', 'mount': '', 'total': n['total'], 'used': 0, 'free': 0, 'percent': 0})
    return jsonify({'items': out, 'docker': os.path.exists('/.dockerenv')})

def safe_path(subpath, root=None):
    # Evita saltos de directorio y el acceso a la carpeta interna .nas
    root = root or STORAGE_ROOT
    target = os.path.normpath(os.path.join(root, (subpath or '').lstrip('/')))
    if not _under(target, root):
        return root
    if root == STORAGE_ROOT and _under(target, META):
        return root
    return target

def rel_of(abs_p, root=None):
    rel = os.path.relpath(abs_p, root or STORAGE_ROOT).replace('\\', '/')
    return '/' if rel == '.' else '/' + rel

def make_item(abs_p, favs, root=None):
    st = os.stat(abs_p)
    rel, name, is_dir = rel_of(abs_p, root), os.path.basename(abs_p), os.path.isdir(abs_p)
    return {
        'n': name,
        't': 'dir' if is_dir else get_file_type(name),
        's': 0 if is_dir else st.st_size,
        'p': rel,
        'd': time.strftime('%Y-%m-%d', time.localtime(st.st_mtime)),
        'm': st.st_mtime,
        'fav': 1 if rel in favs else 0
    }

def walk_items(favs):
    for root, dirs, files in os.walk(STORAGE_ROOT):
        dirs[:] = [d for d in dirs if not (root == STORAGE_ROOT and d == META_NAME)]
        for n in dirs + [f for f in files if not f.endswith('.nasup')]:
            try:
                yield make_item(os.path.join(root, n), favs)
            except OSError:
                continue

@app.route('/api/files/list', methods=['GET'])
def list_files():
    root = drive_root(request.args.get('drive'))
    if not root:
        return jsonify(NO_DRIVE[0]), NO_DRIVE[1]
    abs_path = safe_path(request.args.get('path', ''), root)
    if not os.path.exists(abs_path):
        return jsonify({'error': 'Ruta no encontrada'}), 404
    favs = set(db_load(FAV_DB)) if root == STORAGE_ROOT else set()
    items = []
    try:
        for entry in os.scandir(abs_path):
            if (root == STORAGE_ROOT and abs_path == root and entry.name == META_NAME) or entry.name.endswith('.nasup'):
                continue
            try:
                items.append(make_item(entry.path, favs, root))
            except OSError:
                continue
    except PermissionError:
        return jsonify({'error': 'Permiso denegado'}), 403
    items.sort(key=lambda x: (x['t'] != 'dir', x['n'].lower()))
    return jsonify({'current_path': rel_of(abs_path, root), 'items': items})

@app.route('/api/files/all', methods=['GET'])
def all_files():
    # Todos los archivos/carpetas; con ?type=img|vid solo archivos de ese tipo
    ftype = request.args.get('type')
    items = [i for i in walk_items(set(db_load(FAV_DB))) if not ftype or i['t'] == ftype]
    items.sort(key=lambda x: x['p'].lower())
    return jsonify({'items': items[:2000]})

@app.route('/api/files/recent', methods=['GET'])
def recent_files():
    # Archivos agregados o modificados más recientemente
    items = [i for i in walk_items(set(db_load(FAV_DB))) if i['t'] != 'dir']
    items.sort(key=lambda x: x['m'], reverse=True)
    return jsonify({'items': items[:50]})

@app.route('/api/favorites', methods=['GET'])
def list_favorites():
    favs = db_load(FAV_DB)
    items = []
    for p in favs:
        abs_p = safe_path(p)
        if abs_p != STORAGE_ROOT and os.path.exists(abs_p):
            items.append(make_item(abs_p, set(favs)))
    return jsonify({'items': items})

@app.route('/api/favorites/toggle', methods=['POST'])
def toggle_favorites():
    data = request.json or {}
    want = bool(data.get('fav'))
    with db_lock:
        favs = db_load(FAV_DB)
        for p in data.get('paths', []):
            abs_p = safe_path(p)
            if abs_p == STORAGE_ROOT or not os.path.exists(abs_p):
                continue
            rel = rel_of(abs_p)
            favs = [f for f in favs if f != rel]
            if want:
                favs.append(rel)
        db_save(FAV_DB, favs)
    return jsonify({'success': True})

@app.route('/api/files/mkdir', methods=['POST'])
def make_directory():
    data = request.json or {}
    root = drive_root(data.get('drive'))
    if not root:
        return jsonify(NO_DRIVE[0]), NO_DRIVE[1]
    dir_name = os.path.basename(data.get('name', '').strip())
    if dir_name in ('', '.', '..'):
        return jsonify({'error': 'Nombre inválido'}), 400
    try:
        os.makedirs(os.path.join(safe_path(data.get('path', ''), root), dir_name), exist_ok=True)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/upload', methods=['POST'])
def upload_files():
    root = drive_root(request.form.get('drive'))
    if not root:
        return jsonify(NO_DRIVE[0]), NO_DRIVE[1]
    abs_path = safe_path(request.form.get('path', ''), root)
    if 'files' not in request.files:
        return jsonify({'error': 'No se enviaron archivos'}), 400
    try:
        for file in request.files.getlist('files'):
            if file.filename:
                file.save(os.path.join(abs_path, os.path.basename(file.filename)))
    except OSError as e:
        return jsonify({'error': str(e)}), 500
    return jsonify({'success': True})

@app.route('/api/files/delete', methods=['POST'])
def delete_files():
    # "Eliminar" mueve a la papelera; el borrado definitivo se hace desde /api/trash/delete
    data = request.json or {}
    drive = data.get('drive') or 'sistema'
    root = drive_root(drive)
    if not root:
        return jsonify(NO_DRIVE[0]), NO_DRIVE[1]
    dname = next((d['name'] for d in detect_drives() if d['id'] == drive), drive)
    with db_lock:
        trash, favs = db_load(TRASH_DB), db_load(FAV_DB)
        for p in data.get('paths', []):
            abs_p = safe_path(p, root)
            if abs_p == root or not os.path.exists(abs_p):
                continue
            rel, name, is_dir = rel_of(abs_p, root), os.path.basename(abs_p), os.path.isdir(abs_p)
            size = 0 if is_dir else os.path.getsize(abs_p)
            tid = uuid.uuid4().hex
            os.makedirs(os.path.join(TRASH_DIR, tid))
            try:
                shutil.move(abs_p, os.path.join(TRASH_DIR, tid, name))
            except OSError:
                shutil.rmtree(os.path.join(TRASH_DIR, tid), ignore_errors=True)
                continue
            trash.append({'id': tid, 'n': name, 't': 'dir' if is_dir else get_file_type(name), 's': size,
                          'o': rel, 'dr': drive, 'dn': dname, 'd': time.strftime('%Y-%m-%d'), 'm': time.time()})
            if root == STORAGE_ROOT:
                favs = [f for f in favs if f != rel and not f.startswith(rel + '/')]
        db_save(TRASH_DB, trash)
        db_save(FAV_DB, favs)
    return jsonify({'success': True})

@app.route('/api/trash/list', methods=['GET'])
def trash_list():
    items = sorted(db_load(TRASH_DB), key=lambda x: x['m'], reverse=True)
    return jsonify({'items': [{**i, 'p': i['id'], 'fav': 0} for i in items]})

@app.route('/api/trash/restore', methods=['POST'])
def trash_restore():
    ids = set((request.json or {}).get('ids', []))
    with db_lock:
        keep = []
        for it in db_load(TRASH_DB):
            if it['id'] not in ids:
                keep.append(it)
                continue
            src = os.path.join(TRASH_DIR, it['id'], it['n'])
            if not os.path.exists(src):
                continue  # ya no existe en disco: se descarta de la lista
            root = drive_root(it.get('dr'))
            if not root:  # la unidad no está conectada: se conserva para restaurar después
                keep.append(it)
                continue
            dest = safe_path(it['o'], root)
            if dest == root:
                dest = os.path.join(root, it['n'])
            if os.path.exists(dest):  # si ya hay algo con ese nombre, no se sobrescribe
                dest = unique_dest(os.path.dirname(dest), it['n'], 'restaurado')
            try:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.move(src, dest)
                shutil.rmtree(os.path.join(TRASH_DIR, it['id']), ignore_errors=True)
            except OSError:
                keep.append(it)
        db_save(TRASH_DB, keep)
    return jsonify({'success': True})

@app.route('/api/trash/delete', methods=['POST'])
def trash_delete():
    # Borrado definitivo: {"ids": [...]} o {"all": true} para vaciar la papelera
    data = request.json or {}
    ids = set(data.get('ids', []))
    with db_lock:
        keep = []
        for it in db_load(TRASH_DB):
            if data.get('all') or it['id'] in ids:
                shutil.rmtree(os.path.join(TRASH_DIR, it['id']), ignore_errors=True)
            else:
                keep.append(it)
        db_save(TRASH_DB, keep)
    return jsonify({'success': True})

@app.route('/api/files/copy', methods=['POST'])
def copy_files():
    data = request.json
    paths = data.get('paths', [])
    for p in paths:
        abs_p = safe_path(p)
        if abs_p != STORAGE_ROOT and os.path.exists(abs_p):
            base, ext = os.path.splitext(abs_p)
            new_p = f"{base} (copia){ext}"
            if os.path.isdir(abs_p):
                shutil.copytree(abs_p, new_p, copy_function=shutil.copy)
            else:
                shutil.copy(abs_p, new_p)
    return jsonify({'success': True})

# --- SUBIDA POR PARTES (archivos de decenas de GB, con reanudación) ---
# El cliente envía el archivo en trozos; cada trozo se agrega a un archivo temporal
# oculto (.xxxx.nasup) en la carpeta destino y al terminar se renombra (sin copiar de nuevo).
def _part_path(dest_dir, key):
    return os.path.join(dest_dir, '.' + hashlib.sha1(key.encode()).hexdigest()[:16] + '.nasup')

def _upload_ctx(args):
    root = drive_root(args.get('drive'))
    if not root:
        return None, (NO_DRIVE[0], 404)
    dest_dir = safe_path(args.get('path', ''), root)
    name = os.path.basename((args.get('name') or '').strip())
    if not os.path.isdir(dest_dir) or name in ('', '.', '..') or not args.get('key'):
        return None, ({'error': 'Datos de subida inválidos'}, 400)
    return (dest_dir, name, _part_path(dest_dir, args['key'])), None

@app.route('/api/files/upload/status', methods=['GET'])
def upload_status():
    ctx, err = _upload_ctx(request.args)
    if err:
        return jsonify(err[0]), err[1]
    part = ctx[2]
    return jsonify({'size': os.path.getsize(part) if os.path.exists(part) else 0})

@app.route('/api/files/upload/chunk', methods=['POST'])
def upload_chunk():
    ctx, err = _upload_ctx(request.args)
    if err:
        return jsonify(err[0]), err[1]
    dest_dir, name, part = ctx
    try:
        offset, size = int(request.args['offset']), int(request.args['size'])
    except (KeyError, ValueError):
        return jsonify({'error': 'Parámetros inválidos'}), 400
    have = os.path.getsize(part) if os.path.exists(part) else 0
    if offset > 0 and have != offset:
        return jsonify({'error': 'Desfase en la subida', 'size': have}), 409
    if offset == 0:
        if shutil.disk_usage(dest_dir).free < size:
            return jsonify({'error': f'No hay espacio suficiente en la unidad (faltan {(size - shutil.disk_usage(dest_dir).free) // 1048576} MB)'}), 507
        for e in os.scandir(dest_dir):  # limpia subidas abandonadas hace más de 3 días
            if e.name.endswith('.nasup') and time.time() - e.stat().st_mtime > 3 * 86400:
                os.remove(e.path)
    try:
        with open(part, 'wb' if offset == 0 else 'ab') as f:
            while True:
                buf = request.stream.read(1 << 20)
                if not buf:
                    break
                f.write(buf)
    except OSError:
        return jsonify({'error': 'No se pudo escribir en el disco'}), 500
    except Exception:
        return jsonify({'error': 'Conexión interrumpida'}), 400
    got = os.path.getsize(part)
    if got > size:
        os.remove(part)
        return jsonify({'error': 'El archivo recibido es mayor de lo esperado'}), 400
    if got < size:
        return jsonify({'done': False, 'received': got})
    final = os.path.join(dest_dir, name)
    if os.path.exists(final):  # no se sobrescribe nada existente
        final = unique_dest(dest_dir, name, 'copia')
    os.replace(part, final)
    return jsonify({'done': True, 'name': os.path.basename(final)})

@app.route('/api/files/upload/cancel', methods=['POST'])
def upload_cancel():
    ctx, err = _upload_ctx(request.json or {})
    if not err and os.path.exists(ctx[2]):
        os.remove(ctx[2])
    return jsonify({'success': True})

@app.route('/api/files/download', methods=['GET'])
def download_file():
    root = drive_root(request.args.get('drive'))
    if not root:
        return jsonify(NO_DRIVE[0]), NO_DRIVE[1]
    abs_p = safe_path(request.args.get('path', ''), root)
    if abs_p == root or not os.path.isfile(abs_p):
        return jsonify({'error': 'Archivo no encontrado'}), 404
    resp = send_file(abs_p, as_attachment=True, download_name=os.path.basename(abs_p), conditional=True, max_age=0)
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['Content-Security-Policy'] = 'sandbox'
    return resp

@app.route('/api/files/stream', methods=['GET'])
def stream_file():
    # Sirve imágenes y videos; conditional=True activa las peticiones Range (adelantar/retroceder sin descargar todo)
    root = drive_root(request.args.get('drive'))
    if not root:
        return jsonify(NO_DRIVE[0]), NO_DRIVE[1]
    abs_p = safe_path(request.args.get('path', ''), root)
    if abs_p == root or not os.path.isfile(abs_p):
        return jsonify({'error': 'Archivo no encontrado'}), 404
    resp = send_file(abs_p, conditional=True, max_age=0)
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['Content-Security-Policy'] = 'sandbox'  # un SVG/HTML subido no puede ejecutar scripts
    return resp

def unique_dest(folder, name, tag):
    base, ext = os.path.splitext(name)
    if os.path.isdir(os.path.join(folder, name)):
        base, ext = name, ''
    cand, n = os.path.join(folder, f"{base} ({tag}){ext}"), 2
    while os.path.exists(cand):
        cand = os.path.join(folder, f"{base} ({tag} {n}){ext}")
        n += 1
    return cand

@app.route('/api/files/paste', methods=['POST'])
def paste_files():
    # Pega (copiar o mover) archivos/carpetas, también entre unidades distintas
    data = request.json or {}
    src_root, dst_root = drive_root(data.get('src_drive')), drive_root(data.get('dest_drive'))
    if not src_root or not dst_root:
        return jsonify(NO_DRIVE[0]), NO_DRIVE[1]
    dest_dir = safe_path(data.get('dest_path', ''), dst_root)
    if not os.path.isdir(dest_dir):
        return jsonify({'error': 'Carpeta destino no encontrada'}), 404
    move = data.get('mode') == 'move'
    done = errors = 0
    for p in data.get('paths', []):
        src = safe_path(p, src_root)
        if src == src_root or not os.path.exists(src):
            continue
        if os.path.isdir(src) and _under(dest_dir, src):
            errors += 1  # no se puede pegar una carpeta dentro de sí misma
            continue
        dest = os.path.join(dest_dir, os.path.basename(src))
        if move and os.path.abspath(src) == os.path.abspath(dest):
            continue  # mover a la misma carpeta: nada que hacer
        if os.path.exists(dest):
            dest = unique_dest(dest_dir, os.path.basename(src), 'movido' if move else 'copia')
        try:
            if move:
                shutil.move(src, dest)
            elif os.path.isdir(src):
                shutil.copytree(src, dest, copy_function=shutil.copy)
            else:
                shutil.copy(src, dest)
            done += 1
        except OSError:
            errors += 1
    return jsonify({'success': True, 'done': done, 'errors': errors})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
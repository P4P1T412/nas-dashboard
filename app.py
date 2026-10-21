from flask import Flask, jsonify, render_template, request, send_from_directory, abort
import psutil
import platform
import socket
import time
import os
import shutil
import json
import uuid
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

def safe_path(subpath):
    # Evita saltos de directorio y el acceso a la carpeta interna .nas
    target = os.path.normpath(os.path.join(STORAGE_ROOT, (subpath or '').lstrip('/')))
    inside = target == STORAGE_ROOT or target.startswith(STORAGE_ROOT + os.sep)
    if not inside or target == META or target.startswith(META + os.sep):
        return STORAGE_ROOT
    return target

def rel_of(abs_p):
    rel = os.path.relpath(abs_p, STORAGE_ROOT).replace('\\', '/')
    return '/' if rel == '.' else '/' + rel

def make_item(abs_p, favs):
    st = os.stat(abs_p)
    rel, name, is_dir = rel_of(abs_p), os.path.basename(abs_p), os.path.isdir(abs_p)
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
        for n in dirs + files:
            try:
                yield make_item(os.path.join(root, n), favs)
            except OSError:
                continue

@app.route('/api/files/list', methods=['GET'])
def list_files():
    abs_path = safe_path(request.args.get('path', ''))
    if not os.path.exists(abs_path):
        return jsonify({'error': 'Ruta no encontrada'}), 404
    favs = set(db_load(FAV_DB))
    items = []
    try:
        for entry in os.scandir(abs_path):
            if abs_path == STORAGE_ROOT and entry.name == META_NAME:
                continue
            try:
                items.append(make_item(entry.path, favs))
            except OSError:
                continue
    except PermissionError:
        return jsonify({'error': 'Permiso denegado'}), 403
    items.sort(key=lambda x: (x['t'] != 'dir', x['n'].lower()))
    return jsonify({'current_path': rel_of(abs_path), 'items': items})

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
    data = request.json
    req_path = data.get('path', '')
    dir_name = data.get('name', '')
    if not dir_name:
        return jsonify({'error': 'Nombre inválido'}), 400
    
    dir_name = os.path.basename(dir_name.strip())
    if dir_name in ('', '.', '..'):
        return jsonify({'error': 'Nombre inválido'}), 400
    abs_path = os.path.join(safe_path(req_path), dir_name)
    try:
        os.makedirs(abs_path, exist_ok=True)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/upload', methods=['POST'])
def upload_files():
    req_path = request.form.get('path', '')
    abs_path = safe_path(req_path)
    if 'files' not in request.files:
        return jsonify({'error': 'No se enviaron archivos'}), 400
    
    uploaded_files = request.files.getlist('files')
    for file in uploaded_files:
        if file.filename:
            file.save(os.path.join(abs_path, os.path.basename(file.filename)))
    return jsonify({'success': True})

@app.route('/api/files/delete', methods=['POST'])
def delete_files():
    # "Eliminar" mueve a la papelera; el borrado definitivo se hace desde /api/trash/delete
    paths = (request.json or {}).get('paths', [])
    with db_lock:
        trash, favs = db_load(TRASH_DB), db_load(FAV_DB)
        for p in paths:
            abs_p = safe_path(p)
            if abs_p == STORAGE_ROOT or not os.path.exists(abs_p):
                continue
            rel, name, is_dir = rel_of(abs_p), os.path.basename(abs_p), os.path.isdir(abs_p)
            size = 0 if is_dir else os.path.getsize(abs_p)
            tid = uuid.uuid4().hex
            os.makedirs(os.path.join(TRASH_DIR, tid))
            shutil.move(abs_p, os.path.join(TRASH_DIR, tid, name))
            trash.append({'id': tid, 'n': name, 't': 'dir' if is_dir else get_file_type(name),
                          's': size, 'o': rel, 'd': time.strftime('%Y-%m-%d'), 'm': time.time()})
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
            dest = safe_path(it['o'])
            if dest == STORAGE_ROOT:
                dest = os.path.join(STORAGE_ROOT, it['n'])
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if os.path.exists(dest):  # si ya hay algo con ese nombre, no se sobrescribe
                base, ext = os.path.splitext(dest)
                n = 1
                while os.path.exists(f"{base} (restaurado {n}){ext}"):
                    n += 1
                dest = f"{base} (restaurado {n}){ext}"
            try:
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
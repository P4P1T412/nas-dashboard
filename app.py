from flask import Flask, jsonify, render_template, request, send_from_directory, abort
import psutil
import platform
import socket
import time
import os
import shutil
from pathlib import Path

app = Flask(__name__)

# Directorio raíz base que explorará el NAS dentro del contenedor
# (Te recomiendo montar una carpeta del host aquí con Docker)
STORAGE_ROOT = os.path.abspath('/app/storage')
os.makedirs(STORAGE_ROOT, exist_ok=True)

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
    # Evita ataques de salto de directorio (Path Traversal)
    if not subpath:
        subpath = ""
    target = os.path.normpath(os.path.join(STORAGE_ROOT, subpath.lstrip('/')))
    if not target.startswith(STORAGE_ROOT):
        return STORAGE_ROOT
    return target

@app.route('/api/files/list', methods=['GET'])
def list_files():
    req_path = request.args.get('path', '')
    abs_path = safe_path(req_path)
    
    if not os.path.exists(abs_path):
        return jsonify({'error': 'Ruta no encontrada'}), 404

    items = []
    try:
        for idx, entry in enumerate(os.scandir(abs_path)):
            stat = entry.stat()
            is_dir = entry.is_dir()
            rel_p = os.path.relpath(entry.path, STORAGE_ROOT).replace('\\', '/')
            items.append({
                'id': idx + 1,
                'n': entry.name,
                't': 'dir' if is_dir else get_file_type(entry.name),
                's': 0 if is_dir else stat.st_size,
                'p': '/' + rel_p if rel_p != '.' else '/',
                'd': time.strftime('%Y-%m-%d', time.localtime(stat.st_mtime)),
                'fav': 0
            })
    except PermissionError:
        return jsonify({'error': 'Permiso denegado'}), 403

    return jsonify({'current_path': '/' + os.path.relpath(abs_path, STORAGE_ROOT).replace('\\', '/'), 'items': items})

@app.route('/api/files/mkdir', methods=['POST'])
def make_directory():
    data = request.json
    req_path = data.get('path', '')
    dir_name = data.get('name', '')
    if not dir_name:
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
            file.save(os.path.join(abs_path, file.filename))
    return jsonify({'success': True})

@app.route('/api/files/delete', methods=['POST'])
def delete_files():
    data = request.json
    paths = data.get('paths', []) # lista de rutas relativas
    for p in paths:
        abs_p = safe_path(p)
        if os.path.exists(abs_p):
            if os.path.isdir(abs_p):
                shutil.rmtree(abs_p)
            else:
                os.remove(abs_p)
    return jsonify({'success': True})

@app.route('/api/files/copy', methods=['POST'])
def copy_files():
    data = request.json
    paths = data.get('paths', [])
    for p in paths:
        abs_p = safe_path(p)
        if os.path.exists(abs_p):
            base, ext = os.path.splitext(abs_p)
            new_p = f"{base} (copia){ext}"
            if os.path.isdir(abs_p):
                shutil.copytree(abs_p, new_p)
            else:
                shutil.copy2(abs_p, new_p)
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
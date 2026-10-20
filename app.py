from flask import Flask, jsonify, render_template
import psutil
import platform
import socket
import time

app = Flask(__name__)

# Variables globales para calcular velocidades basadas en deltas de tiempo
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

@app.route('/')
def index():
    return render_template('index.html')

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

    return jsonify({
        'cpu': cpu_usage,
        'ram_percent': ram.percent,
        'ram_total': ram.total,
        'ram_used': ram.used,
        'partitions': partitions
    })

@app.route('/api/performance-details')
def performance_details():
    global last_disk_io, last_disk_time, last_net_io, last_net_time
    
    # --- CPU ---
    cpu_usage = psutil.cpu_percent(interval=None)
    cpu_count_logical = psutil.cpu_count(logical=True) or 1
    cpu_count_physical = psutil.cpu_count(logical=False) or 1
    cpu_freq = psutil.cpu_freq()
    cpu_freq_ghz = round(cpu_freq.current / 1000, 2) if cpu_freq else 0.0
    cpu_model = get_cpu_model()
    process_count = len(psutil.pids())

    # --- RAM ---
    ram = psutil.virtual_memory()
    ram_total_gb = round(ram.total / (1024**3), 2)
    ram_used_gb = round(ram.used / (1024**3), 2)
    ram_free_gb = round(ram.available / (1024**3), 2)

    # --- SSD / Almacenamiento Principal ---
    disk_root = psutil.disk_usage('/')
    disk_total_gb = round(disk_root.total / (1024**3), 2)
    disk_used_gb = round(disk_root.used / (1024**3), 2)
    disk_free_gb = round(disk_root.free / (1024**3), 2)

    # Velocidades de Disco (Lectura / Escritura)
    current_time = time.time()
    current_disk_io = psutil.disk_io_counters()
    
    read_speed_str = "0 KB/s"
    write_speed_str = "0 KB/s"
    
    if last_disk_io and current_disk_io:
        time_diff = current_time - last_disk_time
        if time_diff > 0:
            r_bytes = (current_disk_io.read_bytes - last_disk_io.read_bytes) / time_diff
            w_bytes = (current_disk_io.write_bytes - last_disk_io.write_bytes) / time_diff
            read_speed_str = format_speed(r_bytes)
            write_speed_str = format_speed(w_bytes)
            
    last_disk_io = current_disk_io
    last_disk_time = current_time

    # --- Red / WiFi ---
    current_net_io = psutil.net_io_counters()
    send_speed_str = "0 KB/s"
    recv_speed_str = "0 KB/s"
    
    if last_net_io and current_net_io:
        time_diff = current_time - last_net_time
        if time_diff > 0:
            s_bytes = (current_net_io.bytes_sent - last_net_io.bytes_sent) / time_diff
            r_bytes = (current_net_io.bytes_recv - last_net_io.bytes_recv) / time_diff
            send_speed_str = format_speed(s_bytes)
            recv_speed_str = format_speed(r_bytes)
            
    last_net_io = current_net_io
    last_net_time = current_time

    # Obtener IPs
    ipv4, ipv6 = "127.0.0.1", ""
    for interface, addrs in psutil.net_if_addrs().items():
        if interface.startswith('lo'):
            continue
        for addr in addrs:
            if addr.family == socket.AF_INET and not addr.address.startswith('127.'):
                ipv4 = addr.address
            elif addr.family == socket.AF_INET6 and not addr.address.startswith('::1'):
                ipv6 = addr.address

    return jsonify({
        "cpu": {
            "usage": cpu_usage,
            "processes": process_count,
            "cores_logical": cpu_count_logical,
            "cores_physical": cpu_count_physical,
            "frequency_ghz": cpu_freq_ghz,
            "model": cpu_model
        },
        "ram": {
            "percent": ram.percent,
            "total_gb": ram_total_gb,
            "used_gb": ram_used_gb,
            "free_gb": ram_free_gb
        },
        "disk": {
            "total_gb": disk_total_gb,
            "used_gb": disk_used_gb,
            "free_gb": disk_free_gb,
            "percent": disk_root.percent,
            "read_speed": read_speed_str,
            "write_speed": write_speed_str
        },
        "network": {
            "ipv4": ipv4,
            "ipv6": ipv6,
            "send_speed": send_speed_str,
            "recv_speed": recv_speed_str
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
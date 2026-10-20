from flask import Flask, jsonify, render_template
import psutil
import os

app = Flask(__name__)

# Ruta principal para cargar la interfaz HTML
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/system-stats')
def system_stats():
    # CPU y RAM
    cpu_usage = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory()
    
    # Discos y particiones (detecta internos, USB, SD montados)
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
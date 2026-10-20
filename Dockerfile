FROM python:3.13-slim

WORKDIR /app

# Instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del proyecto
COPY . .

# Exponer el puerto de Flask
EXPOSE 5000

# Ejecutar la aplicación escuchando en todas las interfaces del contenedor
CMD ["python", "app.py"]
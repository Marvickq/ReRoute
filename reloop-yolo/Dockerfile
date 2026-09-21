FROM python:3.10-slim

# Install system libraries required by OpenCV & PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# Install PyTorch CPU first for lightweight fast build
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download YOLOv8 weights during build
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

COPY . .

# Use PORT environment variable assigned by Render (defaults to 8000 locally)
CMD sh -c "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"

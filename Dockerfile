# --- Stage 1: Build the React Frontend ---
FROM node:20-alpine as frontend-builder

WORKDIR /app/frontend
# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy all frontend source files and build
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build the FastAPI Backend & Serve ---
FROM python:3.10-slim

# Prevent Python from writing pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app/backend

# Install system dependencies if required by Google SDKs
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./
# Copy the built React app from the first stage into backend/static
COPY --from=frontend-builder /app/backend/static ./static

# Expose Cloud Run default port
EXPOSE 8080

# Run the FastAPI server using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]

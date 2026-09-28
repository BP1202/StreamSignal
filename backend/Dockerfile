FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered streaming logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install curl for container health checking
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies with extended timeout and retries for network resilience
COPY requirements.txt /app/requirements.txt
RUN pip install --default-timeout=120 --retries 10 -r /app/requirements.txt

# Copy backend application source
COPY . /app/

# Expose backend service port
EXPOSE 8000

# Default command: launch FastAPI server with hot-reload for development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    curl \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 appuser && \
    useradd --system --uid 1001 --gid 1001 appuser

# Celery beat persists its schedule here. Create it owned by appuser so the
# mounted volume is writable by the non-root process (otherwise beat crash-loops
# with "[Errno 13] Permission denied: '/var/celery/celerybeat-schedule'").
RUN mkdir -p /var/celery && chown 1001:1001 /var/celery

# Install Python dependencies as root (before switching user)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Switch to non-root user
USER appuser

EXPOSE 8005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]

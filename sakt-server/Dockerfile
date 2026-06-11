FROM python:3.12-slim

# Security: run as non-root
RUN useradd -m -u 1000 sakt
WORKDIR /app

# Install dependencies first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY main.py .

# Model directory — populated by the training pipeline at runtime
RUN mkdir -p /app/model && chown sakt:sakt /app/model

USER sakt

EXPOSE 10003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:10003/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10003", "--workers", "2", "--log-level", "info"]

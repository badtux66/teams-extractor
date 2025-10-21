# Multi-stage Dockerfile for Teams-to-Jira Processor
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install dependencies
COPY mcp/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Production stage
FROM python:3.11-slim

# Create non-root user
RUN useradd -m -u 1000 processor && \
    mkdir -p /app/data && \
    chown -R processor:processor /app

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PROCESSOR_DATA_DIR=/app/data

# Set working directory
WORKDIR /app

# Copy application code
COPY --chown=processor:processor mcp/ /app/mcp/
COPY --chown=processor:processor processor/ /app/processor/

# Switch to non-root user
USER processor

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8090/health').raise_for_status()"

# Expose port
EXPOSE 8090

# Run processor
CMD ["python", "-m", "processor.server"]

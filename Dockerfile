FROM python:3.12-slim

WORKDIR /app

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency specifications
COPY pyproject.toml .

# Install dependencies into system environment
RUN uv pip install --system --no-cache -r pyproject.toml

# Copy application source and initial data
COPY src/ src/
COPY data/ data/
COPY .env.example .env.example

# Expose port
EXPOSE 8000

ENV HOST=0.0.0.0
ENV PORT=8000
ENV PYTHONPATH=/app/src
CMD ["uvicorn", "fork_cast.app:app", "--host", "0.0.0.0", "--port", "8000"]

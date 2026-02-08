# HubSpot AI Wrapper - Backend (FastAPI)
# For local dev: docker-compose. For production: Railway/Render use their own build.

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# PORT for Railway/Render; default 8000 for local
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

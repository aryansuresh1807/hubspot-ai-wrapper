# HubSpot AI Wrapper - Backend (FastAPI)
# For local dev: docker-compose. For production: Railway/Render use their own build.

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# PORT for Railway/Render; app reads PORT env (default 8080 in main.py)
ENV PORT=8080
EXPOSE 8080

CMD ["python", "-m", "app.main"]

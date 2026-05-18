FROM python:3.14-slim

WORKDIR /app
COPY backend/services/ai-engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/services/ai-engine/ .
EXPOSE 8083
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083"]

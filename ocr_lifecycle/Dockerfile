FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY ocr_lifecycle/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY ocr_lifecycle/app ./app

EXPOSE 8202

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8202"]

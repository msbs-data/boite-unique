FROM python:3.11-slim

WORKDIR /srv

# System dependencies for pikepdf and psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libqpdf-dev \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

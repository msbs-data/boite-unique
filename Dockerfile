FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      libqpdf29t64 zlib1g \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app app
COPY samples samples
COPY tests tests

RUN useradd --system --uid 10001 cabinet && mkdir -p /srv/data && chown -R cabinet /srv
USER cabinet

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

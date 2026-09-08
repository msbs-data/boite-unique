#!/usr/bin/env bash
# Démarre la démonstration sur http://127.0.0.1:8000
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install --quiet --disable-pip-version-check -r requirements.txt
fi

if [ -z "$(ls -A data/entrant/*.eml 2>/dev/null || true)" ]; then
  .venv/bin/python samples/make_samples.py
fi

echo "→ http://127.0.0.1:8000"
exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

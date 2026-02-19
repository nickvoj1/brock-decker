# CV Hard Redaction API (PyMuPDF)

This service performs true PDF redaction for personal information under the candidate name and removes the common top-right profile photo area.

## Run locally

```bash
cd tools/cv-redaction-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8088
```

## Endpoint

- `POST /redact`
- `multipart/form-data` with field `file` (PDF)
- response: `application/pdf`

## Health

- `GET /health`

## Connect in web app

1. Open `CVs` page.
2. Turn on `Hard Delete Personal Info (API)`.
3. Set `Hard Redaction API URL` to your endpoint, e.g. `http://localhost:8088/redact`.

If the API is unavailable, the app falls back to client-side masking (visual redaction only).

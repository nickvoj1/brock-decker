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

The web app tries hard-delete redaction automatically:

1. If your backend serves this as `/redact` on the same domain, no extra setup is needed.
2. Otherwise set `VITE_CV_HARD_DELETE_API_URL` to the full endpoint URL (e.g. `http://localhost:8088/redact`).

If the API is unavailable, the app falls back to client-side masking (visual-only redaction) while preserving PDF quality.

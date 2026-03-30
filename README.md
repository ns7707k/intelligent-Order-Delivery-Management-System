# Intelligent Order Delivery Management System

This repository contains the backend (Flask), frontend (React + Vite), database schema, and a data pipeline for an order delivery management platform.

See the detailed project briefing: [docs/PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md)

Quickstart (development)

Prerequisites
- Python 3.10+ and virtualenv
- Node.js + npm

Start backend

```powershell
# from project root
venv\Scripts\activate
python run.py
```

Start frontend

```bash
cd frontend
npm install
npm run dev
```

Run backend tests

```powershell
# from project root
backend\venv\Scripts\activate
python -m pytest -q tests/backend
```

Preparing repository for GitHub/Hugging Face
- Remove any secrets and API keys before pushing (check `.env` and `backend/.env`).
- This repo includes a top-level `.gitignore` and a `requirements.txt` that references `backend/requirements.txt`.
- For static frontend deployment, build the frontend (`cd frontend && npm run build`) and deploy the `frontend/dist` folder to static hosts or Hugging Face Spaces (static HTML hosting).
- For backend deployment, use a container platform (Docker) or services such as Railway, Render, or Heroku. Hugging Face Spaces supports Python apps primarily via Gradio/Streamlit — consider deploying only the frontend to Spaces and backend to a traditional host, or containerize both and use a platform that supports containers.

Notes
- Canonical DB schema: `database/supabase/schema.sql` (keep in repo).
- Seeds: `database/seed.py`.

Contact
- Add team contacts and repository owner information here.

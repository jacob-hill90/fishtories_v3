# Fishtories v3 🐟

A fresh, deliberately small monorepo for a fishing catch journal.

- **Frontend:** React (JavaScript) + Vite, without extra styling frameworks yet.
- **Backend:** Django 5.2 LTS + Django REST Framework.
- **Database:** SQLite during local development, with Django migrations tracked in the backend.
- **Authentication:** Django's built-in authentication using a custom user model from day one.
- **First API:** A public health check, plus an authenticated, owner-scoped catch CRUD API.

The old `fish_finder` and `fishtories` repositories are **not** imported into this starter. We'll selectively port their useful UI, data fields, map and weather functionality after establishing a working baseline.

## Project structure

```text
fishtories_v3/
├── frontend/                    # React / Vite source
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   └── pages/
│   └── package.json
├── backend/                     # Django project and Django apps
│   ├── config/                  # Project settings, root URLs, WSGI / ASGI
│   ├── apps/
│   │   ├── accounts/            # Custom User model
│   │   └── catches/             # Catch model and owner-scoped API
│   ├── requirements.txt
│   └── manage.py
├── database/                    # Local SQLite file appears here after migrate
└── .gitignore
```

## Requirements

- Python 3.10+ (Python 3.12 or 3.13 recommended)
- Node.js 20.19+ or 22.12+; using Node 22 LTS is a convenient choice
- Git

## 1. Start Django (Terminal 1)

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python manage.py makemigrations accounts catches
python manage.py migrate
python manage.py createsuperuser  # optional: for Django admin
python manage.py runserver
```

On Windows PowerShell, activate the Python environment with `.venv\Scripts\Activate.ps1`, then use `python` in place of `python3` as needed.

Now verify:

- http://127.0.0.1:8000/api/health/ — returns JSON
- http://127.0.0.1:8000/admin/ — Django admin

**Important:** Commit the generated `backend/apps/accounts/migrations/0001_initial.py` and `backend/apps/catches/migrations/0001_initial.py` to Git. Migrations are code and should be versioned; the SQLite database itself should not be committed.

## 2. Start React (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The landing page checks `/api/health/` through Vite's proxy. If both servers are running, you'll see "Django API connected".

To test the production frontend build:

```bash
npm run build
```

## 3. Run backend tests

From `backend/`, with the virtual environment activated:

```bash
python manage.py test
```

The included tests check that users can only see, edit, or delete their own catches. Run them after generating migrations.

## Current API

| Endpoint | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/api/health/` | GET | Public | Check Django is running |
| `/api/catches/` | GET, POST | Logged in | List/create the current user's catches |
| `/api/catches/<id>/` | GET, PUT, PATCH, DELETE | Owner only | View/change/delete a catch |
| `/admin/` | Browser login | Staff account | Django administration |

**Note:** The catch API uses DRF session authentication but the React login/register screens have not yet been built. That is intentional: the first objective is a clean working scaffold. You can sign in to `/admin/` as a staff user to explore the API, and we'll add proper React registration/login next. For browser writes, Django requires a valid CSRF cookie/token.

## Configuration and security

- The only initial `.env` file is `backend/.env`, copied from `.env.example`. **Never commit secrets**.
- Vite proxies `/api` to `http://127.0.0.1:8000` in development; no insecure `CORS_ALLOW_ALL_ORIGINS` configuration is needed.
- Django defaults to local-only settings. Before publishing, set `DJANGO_DEBUG=False`, provide a strong `DJANGO_SECRET_KEY`, and configure `DJANGO_ALLOWED_HOSTS` / `DJANGO_CSRF_TRUSTED_ORIGINS`.
- All catch API queries are scoped to the current account. The API never lets clients assign a different owner.
- The catch model is intentionally small and uses text-only location names. We can design optional GPS coordinates, photos, sharing, and privacy deliberately before adding them.
- For development, SQLite data is written to `database/dev.sqlite3`; the file is Git-ignored. For a free hosting service with an ephemeral filesystem, switch to persistent managed Postgres before deploying. For a persistent VPS, SQLite remains an option with off-site backups.

## Recommended next increments

1. Add React register, login, logout and profile screens backed by secure Django sessions + CSRF protection.
2. Connect a real catch list / create form to the existing catch API.
3. Port or redraw the old Navbar/Home/Fish Database UI, selectively rather than bulk-copying.
4. Add photo uploads with object storage, then maps/weather with quota protection.
5. Add deployment configuration and backups once core workflows pass tests.

## Publish to your own GitHub repository

From the project root, after generating and committing migrations:

```bash
git init
git add .
git commit -m "Initialize Fishtories v3"
```

You can create a **new empty** GitHub repository named `fishtories_v3` in your GitHub account, then run (replace `YOUR_USERNAME`):

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fishtories_v3.git
git push -u origin main
```

Or if you have GitHub CLI installed and authenticated:

```bash
gh repo create fishtories_v3 --private --source=. --remote=origin --push
```

These steps never modify either older repository.

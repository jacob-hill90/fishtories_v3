# Local database files

Django's `DATABASES` setting stores the development database here as
`dev.sqlite3`. The file is created by `python manage.py migrate`.

The database file is intentionally Git-ignored: it can contain accounts,
password hashes, fishing spots and personal catch data. **Don't commit it.**

The **schema** is managed by versioned Django migration files under
`backend/apps/*/migrations/`; `database/` is not a separate backend service.

For deployment on a persistent VPS, SQLite is possible with a proper off-server
backup strategy. For hosting without persistent disks, migrate to PostgreSQL.

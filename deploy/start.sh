#!/bin/sh
set -eu
# One Render instance: migrate safely before starting the service.
python backend/manage.py migrate --noinput
python backend/manage.py seed_fish_species
exec gunicorn --chdir backend config.wsgi:application \
    --bind "0.0.0.0:${PORT:-10000}" \
    --workers 1 --threads 4 --timeout 90 --access-logfile - --error-logfile -

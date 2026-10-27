# Build Vite once; serve the generated frontend from the same Django origin.
FROM node:22-alpine AS frontend-build
WORKDIR /site/frontend
COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=10000
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/
COPY --from=frontend-build /site/frontend/dist ./frontend/dist
# Collect only admin/static assets; production credentials are not needed here.
RUN BUILDING_STATIC_ASSETS=1 DJANGO_DEBUG=True python backend/manage.py collectstatic --noinput
COPY deploy/start.sh ./deploy/start.sh
RUN chmod +x deploy/start.sh
EXPOSE 10000
CMD ["./deploy/start.sh"]

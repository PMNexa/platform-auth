# core_api (errors/exceptions/pagination/filters/uuid7 utils,
# BaseSerializer/BaseViewSet) now comes from the sibling apps/platform-core
# module instead of being vendored here - build this image from the repo
# root, not from this directory:
#   docker build -f apps/platform-auth/backend/Dockerfile -t platform-auth-backend .
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY apps/platform-core/backend /platform-core

COPY apps/platform-auth/backend/requirements.txt apps/platform-auth/backend/manage.py ./
COPY apps/platform-auth/backend/config ./config
COPY apps/platform-auth/backend/platform_auth ./platform_auth

RUN pip install --no-cache-dir -r requirements.txt -e /platform-core

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

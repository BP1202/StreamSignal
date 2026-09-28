FROM postgis/postgis:17-3.5

LABEL maintainer="StreamSignal Team"
LABEL description="PostgreSQL 17 with PostGIS 3.5 and pgvector support"

# Install pgvector package for PostgreSQL 17 from official PGDG repository
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql-17-pgvector && \
    rm -rf /var/lib/apt/lists/*

# Add extension initialization script
COPY init-extensions.sql /docker-entrypoint-initdb.d/01-init-extensions.sql

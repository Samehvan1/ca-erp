#!/bin/sh
set -e

echo "=================================================="
echo "🚀 Starting Capital Agro ERP System Container"
echo "=================================================="

# Function to extract host and port from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname
if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
  DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*@[^:]+:([0-9]+)/.*|\1|')
  [ -z "$DB_PORT" ] && DB_PORT=5432

  echo "⏳ Waiting for PostgreSQL database at $DB_HOST:$DB_PORT to be ready..."
  MAX_RETRIES=30
  COUNT=0
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1 || [ $COUNT -eq $MAX_RETRIES ]; do
    COUNT=$((COUNT + 1))
    echo "  -> Waiting for database connection... ($COUNT/$MAX_RETRIES)"
    sleep 2
  done

  if [ $COUNT -eq $MAX_RETRIES ]; then
    echo "⚠️ Warning: Database check timed out. Attempting Prisma push anyway..."
  else
    echo "✅ Database connection established!"
  fi

  echo "📦 Syncing database schema with Prisma..."
  npx prisma db push --skip-generate --accept-data-loss

  # Auto-seed if AUTO_SEED is true or if SEED_IF_EMPTY is enabled
  if [ "$AUTO_SEED" = "true" ] || [ "$SEED_IF_EMPTY" = "true" ]; then
    echo "🌱 Checking/Running database seed..."
    npm run seed || echo "ℹ️ Seed finished or skipped."
  fi
fi

echo "✨ Starting Capital Agro ERP server on port ${PORT:-4000}..."
exec "$@"

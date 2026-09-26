# 🚀 Capital Agro ERP - VPS Hosting & Deployment Guide

This guide provides step-by-step instructions to host and run **Capital Agro Holding Stock Control & Purchases ERP** on your VPS using Docker alongside **SpaccaPos** or as a standalone instance.

---

## 📋 Architecture & Environment

| Component | Specification | Description |
| :--- | :--- | :--- |
| **Runtime Container** | `node:20-alpine` | Unified multi-stage container serving compiled Express API & React Vite SPA |
| **Port** | `4000` | Exposes both frontend Web App (`/`) and REST API (`/api/v1/*`) |
| **Database** | PostgreSQL 16 | Uses existing `spacca-db` (`capital_agro_erp` database) or standalone DB |
| **DB Credentials** | `postgres` / `mero1901` | Standardized with SpaccaPos on the VPS |
| **Auto-Sync** | Prisma ORM | Automatically syncs schema & seeds initial accounts on container start |

---

## ⚡ Option 1: 1-Click Automated Deployment (Recommended)

The automated script [`deploy.sh`](file:///d:/MyWorks/SpaccaTests/TestApps/CA_ERP/deploy.sh) handles everything automatically:
1. Detects the running `spacca-db` container.
2. Creates the `capital_agro_erp` database inside PostgreSQL if it does not already exist.
3. Generates the production `.env` configuration.
4. Builds the optimized Docker image.
5. Starts the service with automatic database migrations and initial seeding.
6. Runs a health check to verify uptime.

### Run on your VPS:

```bash
# 1. Navigate to the project directory on your VPS
cd /path/to/CA_ERP

# 2. Make the deployment script executable
chmod +x deploy.sh docker-entrypoint.sh

# 3. Run the automated deployment
./deploy.sh
```

---

## 🛠 Option 2: Manual Step-by-Step Setup

If you prefer to run each step manually:

### Step 1: Create the PostgreSQL Database
If `spacca-db` is already running on the VPS:
```bash
docker exec -i spacca-db psql -U postgres -c "CREATE DATABASE capital_agro_erp;"
```

*(If using a local PostgreSQL instance on the host)*:
```bash
PGPASSWORD="mero1901" psql -h localhost -U postgres -c "CREATE DATABASE capital_agro_erp;"
```

### Step 2: Configure Environment Variables
Create `.env` in the root directory:
```bash
cat <<EOF > .env
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://postgres:mero1901@host.docker.internal:5432/capital_agro_erp"
JWT_SECRET="ca-jwt-production-secret-key-2026"
CLIENT_ORIGIN="http://localhost:4000"
AUTO_SEED=true
TZ=Africa/Cairo
EOF
```

### Step 3: Build & Launch with Docker Compose
```bash
chmod +x docker-entrypoint.sh
docker compose build --no-cache
docker compose up -d
```

### Step 4: Verify Service Health
```bash
curl http://localhost:4000/health
```
**Expected Response:**
```json
{"status":"ok","service":"capital-agro-erp","time":"2026-09-27T00:00:00.000Z"}
```

---

## 🌐 Option 3: Standalone Deployment (with Dedicated Database)

If you want an isolated PostgreSQL instance for CA_ERP on a different port (e.g. `5433`):

```bash
docker compose -f docker-compose.standalone.yml up -d --build
```

---

## 🔒 Nginx Reverse Proxy & SSL Configuration (Optional)

If you wish to route a domain or subdomain (e.g., `erp.31-97-157-159.sslip.io` or `erp.yourdomain.com`) to port `4000`:

### Nginx Server Block:
```nginx
server {
    listen 80;
    server_name erp.31-97-157-159.sslip.io;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable SSL via Certbot:
```bash
certbot --nginx -d erp.31-97-157-159.sslip.io
```

---

## 🔑 Default Seeded User Accounts

All accounts are pre-configured with the default password: **`Admin@123`**

| Role | Email | Scope / Responsibility |
| :--- | :--- | :--- |
| **System Administrator** | `admin@capitalagro.com` | Full system administration, user management, audit verification |
| **Chief Financial Officer (CFO)** | `cfo@capitalagro.com` | High-value DoA approvals, GL reconciliation, financial statements |
| **Group Executive** | `exec@capitalagro.com` | Holding-wide requisition consolidation, executive KPIs |
| **Procurement Officer** | `procurement@capitalagro.com` | PO generation, vendor management, 3-way invoice matching |
| **Fanshy Warehouse Manager** | `wm.fanshy@capitalagro.com` | Fanshy Central Depot inventory, GRN receiving, transfers |
| **Osta Warehouse Manager** | `wm.osta@capitalagro.com` | Osta Central Depot inventory, GRN receiving, transfers |
| **Spacca Warehouse Manager** | `wm.spacca@capitalagro.com` | Spacca Roastery inventory, GRN receiving, transfers |
| **Branch Manager** | `bm.fanshy@capitalagro.com` | Branch stock monitoring, transfer/requisition requests |
| **Head Chef** | `chef.fanshy@capitalagro.com` | Fanshy kitchen requisitions, recipe BOM, waste logging |
| **Head Barista** | `barista.spacca@capitalagro.com` | Spacca barista requisitions, recipe BOM, waste logging |
| **Cost Controller** | `cost@capitalagro.com` | Landed cost allocations, stock adjustments, recipe variance |

---

## 📦 Database Backup & Restore

### Backup the Database
```bash
# Via SpaccaPos db container:
docker exec -t spacca-db pg_dump -U postgres -d capital_agro_erp -F c -b -v -f /tmp/ca_erp_backup.dump
docker cp spacca-db:/tmp/ca_erp_backup.dump ./backups/ca_erp_$(date +%Y%m%d_%H%M%S).dump

# Or via host pg_dump:
PGPASSWORD="mero1901" pg_dump -h localhost -U postgres -d capital_agro_erp -F c -b -v -f ./backups/ca_erp_backup.dump
```

### Restore the Database
```bash
PGPASSWORD="mero1901" pg_restore -h localhost -U postgres -d capital_agro_erp -v ./backups/ca_erp_backup.dump
```

---

## 🛠 Useful Operational Commands

```bash
# View real-time container logs
docker compose logs -f ca-erp

# Restart the application
docker compose restart ca-erp

# Stop the container
docker compose down

# Re-run Prisma seed manually inside the container
docker exec -it ca-erp-app npm run seed
```

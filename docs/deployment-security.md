# Deployment Security Configuration

Transport encryption (TLS 1.3) and at-rest encryption (AES-256) are deployment-level controls. The application is TLS-termination ready and database-agnostic; apply the configuration below on the target platform.

## 1. TLS 1.3 — Transport Encryption

### Nginx (recommended reverse proxy)

```nginx
server {
    listen 443 ssl;
    http2 on;

    ssl_protocols TLSv1.3;                 # TLS 1.3 ONLY — reject 1.2 and below
    ssl_ciphers TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
    ssl_prefer_server_ciphers on;
    ssl_session_tickets off;
    ssl_early_data on;                     # 0-RTT (optional)

    ssl_certificate     /etc/ssl/certs/capital-agro.crt;
    ssl_certificate_key /etc/ssl/private/capital-agro.key;

    # HSTS — force HTTPS, preload
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    return 301 https://$host$request_uri;  # redirect all HTTP
}
```

### Verification

```bash
# Confirm only TLS 1.3 is offered
openssl s_client -connect app.capitalagro.com:443 -tls1_2 </dev/null 2>&1 | grep -i "alert\|error"
# → handshake failure expected (1.2 rejected)

openssl s_client -connect app.capitalagro.com:443 -tls1_3 </dev/null 2>&1 | grep "Protocol"
# → Protocol  : TLSv1.3

# Full scan
nmap --script ssl-enum-ciphers -p 443 app.capitalagro.com
```

### Azure App Service / Azure Front Door

- App Service: TLS/SSL settings → **Minimum TLS version: 1.3** (or 1.2 as floor, 1.3 preferred)
- Front Door: Custom domain HTTPS → enforce TLS 1.3; enable HSTS
- Certificate: Azure Key Vault-managed cert, auto-renewal

## 2. AES-256 — At-Rest Encryption

### Azure SQL / PostgreSQL (Azure Database)

```bash
# Azure Database for PostgreSQL — encryption at rest is enabled by default
# using AES-256 with Microsoft-managed keys. For customer-managed keys (CMK):
az postgres flexible-server update \
  --resource-group capital-agro \
  --name capital-agro-db \
  --byok-uri "https://capital-agro-kv.vault.azure.net/keys/db-key/..."

# Azure SQL Database — TDE (Transparent Data Encryption) with AES-256
az sql db tde set --resource-group capital-agro --server capital-agro-sql \
  --database capital-agro --status Enabled
```

### Self-hosted PostgreSQL

```sql
-- Cluster-level: encrypt data files with AES-256 (pgcrypto / LUKS on data volume)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Column-level for sensitive fields (e.g., vendor bank details)
UPDATE vendors SET bank_account = pgp_sym_encrypt(bank_account, '<master-key>', 'cipher-algo=aes256');
```

### Backup encryption

- Azure Backup / managed disk snapshots: AES-256 by default
- Offsite copies: `gpg --symmetric --cipher-algo AES256 backup.sql`

### Application-level notes

- Passwords: bcrypt (cost 10) — never reversible, not AES
- JWT secret: 256-bit random, stored in environment (`JWT_SECRET`), rotated quarterly
- The API never returns `passwordHash` (stripped in all user responses)

## 3. Environment variables (production)

```env
# server/.env.production
DATABASE_URL=postgresql://capital_agro:***@capital-agro-db.postgres.database.azure.com:5432/capital_agro?sslmode=require
JWT_SECRET=<256-bit random>
JWT_EXPIRES_IN=8h
PORT=4000
NODE_ENV=production
CORS_ORIGIN=https://app.capitalagro.com
```

## 4. Hardening checklist

- [ ] TLS 1.3 enforced, TLS 1.2 rejected
- [ ] HSTS preload header active
- [ ] AES-256 at-rest on database + backups
- [x] `helmet` middleware active (already in `app.ts`)
- [ ] JWT secret rotated quarterly
- [ ] Audit log shipped to immutable/SIEM storage
- [x] Dependency scanning in CI (`npm audit --audit-level=high` step; 0 vulnerabilities in both workspaces)
- [x] Rate limiting on `/auth/login` (implemented in-app: 10 failed / 15 min, `skipSuccessfulRequests`; API surface 600 / 15 min)
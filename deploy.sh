#!/bin/bash
# ==============================================================================
# Capital Agro ERP - 1-Click Automated Deployment Script for VPS
# ==============================================================================
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}===================================================================${NC}"
echo -e "${CYAN}      🌾 CAPITAL AGRO ERP - AUTOMATED VPS DEPLOYMENT SYSTEM 🌾     ${NC}"
echo -e "${CYAN}===================================================================${NC}"

# 1. Check prerequisites
echo -e "\n${BLUE}[1/5] Checking environment and dependencies...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
  exit 1
fi

COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
  if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    echo -e "${RED}❌ Docker Compose is not installed. Please install docker-compose plugin.${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}✅ Docker & Docker Compose detected ($COMPOSE_CMD).${NC}"

# 2. Database provisioning
echo -e "\n${BLUE}[2/5] Checking PostgreSQL Database on VPS (SpaccaPos db)...${NC}"
DB_USER="postgres"
DB_PASS="mero1901"
DB_NAME="capital_agro_erp"

# Check if spacca-db container exists and is running
if docker ps --format '{{.Names}}' | grep -q "^spacca-db$"; then
  echo -e "${GREEN}✅ Found running SpaccaPos database container 'spacca-db'.${NC}"
  
  # Check if capital_agro_erp database exists in spacca-db
  DB_EXISTS=$(docker exec -i spacca-db psql -U "$DB_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" 2>/dev/null || echo "0")
  if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${GREEN}✅ Database '$DB_NAME' already exists in spacca-db.${NC}"
  else
    echo -e "${YELLOW}⚙️ Creating database '$DB_NAME' inside spacca-db container...${NC}"
    docker exec -i spacca-db psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
    echo -e "${GREEN}✅ Database '$DB_NAME' successfully created!${NC}"
  fi
else
  echo -e "${YELLOW}ℹ️ 'spacca-db' container not found running directly.${NC}"
  echo -e "${YELLOW}   Ensuring PostgreSQL is accessible on host port 5432...${NC}"
  if command -v PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -lqt &> /dev/null; then
    if ! PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
      echo -e "${YELLOW}⚙️ Creating database '$DB_NAME' on PostgreSQL server...${NC}"
      PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
      echo -e "${GREEN}✅ Database '$DB_NAME' created!${NC}"
    else
      echo -e "${GREEN}✅ Database '$DB_NAME' already exists on host PostgreSQL.${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️ Notice: Database will be verified/connected by the ERP container on startup.${NC}"
  fi
fi

# 3. Prepare Environment Configuration (.env)
echo -e "\n${BLUE}[3/5] Setting up environment variables...${NC}"
if [ ! -f .env ]; then
  echo -e "${YELLOW}📝 Creating production .env file...${NC}"
  cat <<EOF > .env
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@host.docker.internal:5432/${DB_NAME}"
JWT_SECRET="ca-jwt-secret-$(date +%s%N | sha256sum | head -c 32)"
CLIENT_ORIGIN="http://localhost:4000"
AUTO_SEED=true
TZ=Africa/Cairo
EOF
  echo -e "${GREEN}✅ Created .env configuration.${NC}"
else
  echo -e "${GREEN}✅ Existing .env file found.${NC}"
fi

# 4. Build and Start Container
echo -e "\n${BLUE}[4/5] Building and launching Capital Agro ERP container...${NC}"
$COMPOSE_CMD down --remove-orphans || true
$COMPOSE_CMD build --no-cache
$COMPOSE_CMD up -d

# 5. Verify Health Check
echo -e "\n${BLUE}[5/5] Verifying deployment health...${NC}"
echo -e "⏳ Waiting for ERP services to initialize (Prisma push & seeding)..."

HEALTHY=0
for i in {1..20}; do
  sleep 3
  if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  echo "   ... waiting for service to respond ($i/20)"
done

if [ $HEALTHY -eq 1 ]; then
  echo -e "\n${GREEN}===================================================================${NC}"
  echo -e "${GREEN}🎉 CAPITAL AGRO ERP IS SUCCESSFULLY DEPLOYED AND RUNNING! 🎉${NC}"
  echo -e "${GREEN}===================================================================${NC}"
  echo -e "\n${CYAN}📍 Application URL:${NC} http://localhost:4000 (or http://<VPS-IP>:4000)"
  echo -e "${CYAN}🏥 Health Check:${NC}    http://localhost:4000/health"
  echo -e "\n${YELLOW}🔑 Default User Credentials (Seeded):${NC}"
  echo -e "   • System Admin:         admin@capitalagro.com       | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • CFO:                  cfo@capitalagro.com         | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • Procurement Officer:  procurement@capitalagro.com | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • Fanshy WH Manager:    wm.fanshy@capitalagro.com   | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • Osta WH Manager:      wm.osta@capitalagro.com     | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • Spacca WH Manager:    wm.spacca@capitalagro.com   | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • Branch Manager:       bm.fanshy@capitalagro.com   | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • Head Chef:            chef.fanshy@capitalagro.com | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • Head Barista:         barista.spacca@capitalagro.com | Password: ${GREEN}Admin@123${NC}"
  echo -e "   • Cost Controller:      cost@capitalagro.com        | Password: ${GREEN}Admin@123${NC}"
  echo -e "\n${CYAN}🛠 Useful Commands:${NC}"
  echo -e "   • View container logs:  ${CYAN}$COMPOSE_CMD logs -f${NC}"
  echo -e "   • Restart container:    ${CYAN}$COMPOSE_CMD restart${NC}"
  echo -e "   • Stop container:       ${CYAN}$COMPOSE_CMD down${NC}"
  echo -e "===================================================================\n"
else
  echo -e "\n${RED}⚠️ Health check did not return 200 within 60s. Inspecting logs:${NC}"
  $COMPOSE_CMD logs --tail=40
fi

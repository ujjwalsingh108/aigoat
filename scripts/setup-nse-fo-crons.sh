#!/bin/bash

# ============================================================================
# Setup Cron Jobs for NSE F&O Edge Functions on Droplet
# ============================================================================
# This script sets up cron jobs to invoke Supabase Edge Functions
# for NSE F&O data fetching
# ============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   NSE F&O Edge Function Cron Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Supabase Configuration
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

# Create scripts directory
SCRIPTS_DIR="/root/aigoat/cron-scripts"
mkdir -p "$SCRIPTS_DIR"

echo -e "\n${YELLOW}Creating NSE F&O edge function invoke scripts...${NC}"

# ============================================================================
# 1. NSE F&O Fetch NIFTY Contracts (Daily at 8:00 AM IST)
# ============================================================================
cat > "$SCRIPTS_DIR/invoke-nse-fo-fetch-contracts.sh" << 'EOF'
#!/bin/bash
# Invoke NSE F&O Fetch NIFTY Contracts Edge Function
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

curl -X POST "${SUPABASE_URL}/functions/v1/nse_fo_fetch_nifty_contracts" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 600 \
  >> /root/logs/nse-fo-fetch-contracts-cron.log 2>&1
EOF

chmod +x "$SCRIPTS_DIR/invoke-nse-fo-fetch-contracts.sh"
echo -e "${GREEN}✓ Created invoke-nse-fo-fetch-contracts.sh${NC}"

# ============================================================================
# 2. NSE F&O 5-Min Historical Data (Every 5 minutes during market hours)
# ============================================================================
cat > "$SCRIPTS_DIR/invoke-nse-fo-5min.sh" << 'EOF'
#!/bin/bash
# Invoke NSE F&O 5-Min Historical Data Edge Function
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

curl -X POST "${SUPABASE_URL}/functions/v1/nse_fo_historical_5min" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /root/logs/nse-fo-5min-cron.log 2>&1
EOF

chmod +x "$SCRIPTS_DIR/invoke-nse-fo-5min.sh"
echo -e "${GREEN}✓ Created invoke-nse-fo-5min.sh${NC}"

# ============================================================================
# Setup Cron Jobs
# ============================================================================
echo -e "\n${YELLOW}Setting up NSE F&O cron jobs...${NC}"

# Backup existing crontab
crontab -l > /tmp/crontab.backup 2>/dev/null || true

# Create new crontab with NSE F&O edge function crons
cat > /tmp/nse-fo-crons << 'CRONEOF'
# ============================================================================
# NSE F&O Edge Function Cron Jobs
# ============================================================================

# NSE F&O Fetch NIFTY Contracts - Daily at 8:00 AM IST (Mon-Fri)
# Fetches all NIFTY/BANKNIFTY contracts for the day
0 8 * * 1-5 /root/aigoat/cron-scripts/invoke-nse-fo-fetch-contracts.sh

# NSE F&O 5-Min Data - Every 5 minutes during market hours (9:00 AM - 3:35 PM IST)
# Runs Mon-Fri only during trading hours
*/5 9-15 * * 1-5 /root/aigoat/cron-scripts/invoke-nse-fo-5min.sh
30-59/5 15 * * 1-5 /root/aigoat/cron-scripts/invoke-nse-fo-5min.sh

CRONEOF

# Merge with existing crontab (if any)
if [ -f /tmp/crontab.backup ]; then
    # Remove old NSE F&O crons if they exist
    grep -v "invoke-nse-fo-fetch-contracts\|invoke-nse-fo-5min" /tmp/crontab.backup > /tmp/crontab.clean || true
    cat /tmp/crontab.clean /tmp/nse-fo-crons | crontab -
else
    cat /tmp/nse-fo-crons | crontab -
fi

echo -e "${GREEN}✓ NSE F&O cron jobs installed${NC}"

# ============================================================================
# Create log files and set permissions
# ============================================================================
echo -e "\n${YELLOW}Setting up log files...${NC}"

mkdir -p /root/logs
touch /root/logs/nse-fo-fetch-contracts-cron.log
touch /root/logs/nse-fo-5min-cron.log

chmod 644 /root/logs/nse-fo-*-cron.log

echo -e "${GREEN}✓ Log files created${NC}"

# ============================================================================
# Display Summary
# ============================================================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Cron Schedule:${NC}"
echo -e "  ${GREEN}NSE F&O Fetch Contracts:${NC} Daily at 8:00 AM IST (Mon-Fri)"
echo -e "  ${GREEN}NSE F&O 5-Min Data:${NC} Every 5 min (9:00 AM - 3:35 PM IST, Mon-Fri)"

echo -e "\n${YELLOW}Scripts Location:${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/invoke-nse-fo-fetch-contracts.sh${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/invoke-nse-fo-5min.sh${NC}"

echo -e "\n${YELLOW}Log Files:${NC}"
echo -e "  ${GREEN}/root/logs/nse-fo-fetch-contracts-cron.log${NC}"
echo -e "  ${GREEN}/root/logs/nse-fo-5min-cron.log${NC}"

echo -e "\n${YELLOW}View Current Crontab:${NC}"
echo -e "  ${GREEN}crontab -l${NC}"

echo -e "\n${YELLOW}Monitor Logs:${NC}"
echo -e "  ${GREEN}tail -f /root/logs/nse-fo-fetch-contracts-cron.log${NC}"
echo -e "  ${GREEN}tail -f /root/logs/nse-fo-5min-cron.log${NC}"

echo -e "\n${YELLOW}Test Edge Functions Manually:${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/invoke-nse-fo-fetch-contracts.sh${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/invoke-nse-fo-5min.sh${NC}"

echo -e "\n${GREEN}Done!${NC}"

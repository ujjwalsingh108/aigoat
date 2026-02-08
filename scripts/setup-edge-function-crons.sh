#!/bin/bash

# ============================================================================
# Setup Cron Jobs for Supabase Edge Functions on Droplet
# ============================================================================
# This script sets up cron jobs to invoke Supabase Edge Functions
# for fetching historical data at different intervals
# ============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Edge Function Cron Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Supabase Configuration
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

# Edge Function URLs
NSE_EQUITY_5MIN_URL="${SUPABASE_URL}/functions/v1/nse_equity_historical_5min"
BSE_EQUITY_5MIN_URL="${SUPABASE_URL}/functions/v1/bse_equity_historical_5min"
NSE_SWING_1HR_URL="${SUPABASE_URL}/functions/v1/nse_swing_historical_1hr"
BSE_SWING_1HR_URL="${SUPABASE_URL}/functions/v1/bse_swing_historical_1hr"

# Create scripts directory
SCRIPTS_DIR="/root/aigoat/cron-scripts"
mkdir -p "$SCRIPTS_DIR"

echo -e "\n${YELLOW}Creating edge function invoke scripts...${NC}"

# ============================================================================
# 1. NSE Equity 5-Min Historical Data (Market Hours Only)
# ============================================================================
cat > "$SCRIPTS_DIR/invoke-nse-equity-5min.sh" << 'EOF'
#!/bin/bash
# Invoke NSE Equity 5-Min Historical Data Edge Function
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

curl -X POST "${SUPABASE_URL}/functions/v1/nse_equity_historical_5min" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /root/logs/nse-equity-5min-cron.log 2>&1
EOF

chmod +x "$SCRIPTS_DIR/invoke-nse-equity-5min.sh"
echo -e "${GREEN}✓ Created invoke-nse-equity-5min.sh${NC}"

# ============================================================================
# 2. BSE Equity 5-Min Historical Data (Market Hours Only)
# ============================================================================
cat > "$SCRIPTS_DIR/invoke-bse-equity-5min.sh" << 'EOF'
#!/bin/bash
# Invoke BSE Equity 5-Min Historical Data Edge Function
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

curl -X POST "${SUPABASE_URL}/functions/v1/bse_equity_historical_5min" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /root/logs/bse-equity-5min-cron.log 2>&1
EOF

chmod +x "$SCRIPTS_DIR/invoke-bse-equity-5min.sh"
echo -e "${GREEN}✓ Created invoke-bse-equity-5min.sh${NC}"

# ============================================================================
# 3. NSE Swing 1-Hour Historical Data
# ============================================================================
cat > "$SCRIPTS_DIR/invoke-nse-swing-1hr.sh" << 'EOF'
#!/bin/bash
# Invoke NSE Swing 1-Hour Historical Data Edge Function
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

curl -X POST "${SUPABASE_URL}/functions/v1/nse_swing_historical_1hr" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 600 \
  >> /root/logs/nse-swing-1hr-cron.log 2>&1
EOF

chmod +x "$SCRIPTS_DIR/invoke-nse-swing-1hr.sh"
echo -e "${GREEN}✓ Created invoke-nse-swing-1hr.sh${NC}"

# ============================================================================
# 4. BSE Swing 1-Hour Historical Data
# ============================================================================
cat > "$SCRIPTS_DIR/invoke-bse-swing-1hr.sh" << 'EOF'
#!/bin/bash
# Invoke BSE Swing 1-Hour Historical Data Edge Function
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

curl -X POST "${SUPABASE_URL}/functions/v1/bse_swing_historical_1hr" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 600 \
  >> /root/logs/bse-swing-1hr-cron.log 2>&1
EOF

chmod +x "$SCRIPTS_DIR/invoke-bse-swing-1hr.sh"
echo -e "${GREEN}✓ Created invoke-bse-swing-1hr.sh${NC}"

# ============================================================================
# Setup Cron Jobs
# ============================================================================
echo -e "\n${YELLOW}Setting up cron jobs...${NC}"

# Backup existing crontab
crontab -l > /tmp/crontab.backup 2>/dev/null || true

# Create new crontab with edge function crons
cat > /tmp/edge-function-crons << 'CRONEOF'
# ============================================================================
# Supabase Edge Function Cron Jobs
# ============================================================================

# NSE Equity 5-Min Data - Every 5 minutes during market hours (9:00 AM - 3:35 PM IST)
# Runs Mon-Fri only during trading hours
*/5 9-15 * * 1-5 /root/aigoat/cron-scripts/invoke-nse-equity-5min.sh
30-59/5 15 * * 1-5 /root/aigoat/cron-scripts/invoke-nse-equity-5min.sh

# BSE Equity 5-Min Data - Every 5 minutes during market hours (9:00 AM - 3:35 PM IST)
# Runs Mon-Fri only during trading hours
*/5 9-15 * * 1-5 /root/aigoat/cron-scripts/invoke-bse-equity-5min.sh
30-59/5 15 * * 1-5 /root/aigoat/cron-scripts/invoke-bse-equity-5min.sh

# NSE Swing 1-Hour Data - Every hour during extended hours (8:00 AM - 5:00 PM IST)
# Runs Mon-Fri for swing trading analysis
0 8-17 * * 1-5 /root/aigoat/cron-scripts/invoke-nse-swing-1hr.sh

# BSE Swing 1-Hour Data - Every hour during extended hours (8:00 AM - 5:00 PM IST)
# Runs Mon-Fri for swing trading analysis
0 8-17 * * 1-5 /root/aigoat/cron-scripts/invoke-bse-swing-1hr.sh

CRONEOF

# Merge with existing crontab (if any)
if [ -f /tmp/crontab.backup ]; then
    # Remove old edge function crons if they exist
    grep -v "invoke-nse-equity-5min\|invoke-bse-equity-5min\|invoke-nse-swing-1hr\|invoke-bse-swing-1hr" /tmp/crontab.backup > /tmp/crontab.clean || true
    cat /tmp/crontab.clean /tmp/edge-function-crons | crontab -
else
    cat /tmp/edge-function-crons | crontab -
fi

echo -e "${GREEN}✓ Cron jobs installed${NC}"

# ============================================================================
# Create log files and set permissions
# ============================================================================
echo -e "\n${YELLOW}Setting up log files...${NC}"

mkdir -p /root/logs
touch /root/logs/nse-equity-5min-cron.log
touch /root/logs/bse-equity-5min-cron.log
touch /root/logs/nse-swing-1hr-cron.log
touch /root/logs/bse-swing-1hr-cron.log

chmod 644 /root/logs/*-cron.log

echo -e "${GREEN}✓ Log files created${NC}"

# ============================================================================
# Display Summary
# ============================================================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Cron Schedule:${NC}"
echo -e "  ${GREEN}NSE Equity 5-Min:${NC} Every 5 min (9:00 AM - 3:35 PM IST, Mon-Fri)"
echo -e "  ${GREEN}BSE Equity 5-Min:${NC} Every 5 min (9:00 AM - 3:35 PM IST, Mon-Fri)"
echo -e "  ${GREEN}NSE Swing 1-Hour:${NC} Every hour (8:00 AM - 5:00 PM IST, Mon-Fri)"
echo -e "  ${GREEN}BSE Swing 1-Hour:${NC} Every hour (8:00 AM - 5:00 PM IST, Mon-Fri)"

echo -e "\n${YELLOW}Scripts Location:${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/${NC}"

echo -e "\n${YELLOW}Log Files:${NC}"
echo -e "  ${GREEN}/root/logs/nse-equity-5min-cron.log${NC}"
echo -e "  ${GREEN}/root/logs/bse-equity-5min-cron.log${NC}"
echo -e "  ${GREEN}/root/logs/nse-swing-1hr-cron.log${NC}"
echo -e "  ${GREEN}/root/logs/bse-swing-1hr-cron.log${NC}"

echo -e "\n${YELLOW}View Current Crontab:${NC}"
echo -e "  ${GREEN}crontab -l${NC}"

echo -e "\n${YELLOW}Monitor Logs:${NC}"
echo -e "  ${GREEN}tail -f /root/logs/nse-equity-5min-cron.log${NC}"
echo -e "  ${GREEN}tail -f /root/logs/bse-equity-5min-cron.log${NC}"
echo -e "  ${GREEN}tail -f /root/logs/nse-swing-1hr-cron.log${NC}"
echo -e "  ${GREEN}tail -f /root/logs/bse-swing-1hr-cron.log${NC}"

echo -e "\n${YELLOW}Test Edge Functions Manually:${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/invoke-nse-equity-5min.sh${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/invoke-bse-equity-5min.sh${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/invoke-nse-swing-1hr.sh${NC}"
echo -e "  ${GREEN}$SCRIPTS_DIR/invoke-bse-swing-1hr.sh${NC}"

echo -e "\n${GREEN}Done!${NC}"

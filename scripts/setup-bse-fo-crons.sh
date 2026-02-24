#!/bin/bash

# ============================================================================
# Setup Cron Jobs for BSE F&O Edge Functions on Droplet
# ============================================================================
# This script sets up cron jobs to invoke Supabase Edge Functions
# for BSE F&O data fetching
# ============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   BSE F&O Edge Function Cron Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Supabase Configuration
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

# Create scripts directory
SCRIPTS_DIR="/root/aigoat/cron-scripts"
mkdir -p "$SCRIPTS_DIR"

# Create logs directory
mkdir -p /root/logs

echo -e "\n${YELLOW}Creating BSE F&O edge function invoke scripts...${NC}"

# ============================================================================
# BSE F&O 5-Min Historical Data (Every 5 minutes during market hours)
# ============================================================================
cat > "$SCRIPTS_DIR/invoke-bse-fo-5min.sh" << 'EOF'
#!/bin/bash
# Invoke BSE F&O 5-Min Historical Data Edge Function
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDYwNjksImV4cCI6MjA3MDQ4MjA2OX0.6BqGUdju8WlDe_cKov6CAhYx4NOLXWsbFP0kNUb8bk8"

curl -X POST "${SUPABASE_URL}/functions/v1/bse_fo_historical_5min" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /root/logs/bse-fo-5min-cron.log 2>&1
EOF

chmod +x "$SCRIPTS_DIR/invoke-bse-fo-5min.sh"
echo -e "${GREEN}✓ Created invoke-bse-fo-5min.sh${NC}"

# ============================================================================
# Setup Cron Jobs
# ============================================================================
echo -e "\n${YELLOW}Setting up BSE F&O cron jobs...${NC}"

# Backup existing crontab
crontab -l > /tmp/crontab.backup 2>/dev/null || true

# Create new crontab with BSE F&O edge function crons
cat > /tmp/bse-fo-crons << 'CRONEOF'
# ============================================================================
# BSE F&O Edge Function Cron Jobs
# ============================================================================

# BSE F&O 5-Min Data - Every 5 minutes during market hours (9:00 AM - 3:35 PM IST)
# Runs Mon-Fri only during trading hours
*/5 9-15 * * 1-5 /root/aigoat/cron-scripts/invoke-bse-fo-5min.sh
30-59/5 15 * * 1-5 /root/aigoat/cron-scripts/invoke-bse-fo-5min.sh

CRONEOF

# Merge with existing crontab (if any)
if [ -f /tmp/crontab.backup ]; then
    # Remove old BSE F&O crons if they exist
    grep -v "invoke-bse-fo-5min" /tmp/crontab.backup > /tmp/crontab.clean || true
    cat /tmp/crontab.clean /tmp/bse-fo-crons | crontab -
else
    cat /tmp/bse-fo-crons | crontab -
fi

echo -e "${GREEN}✓ Cron jobs installed${NC}"

# Display installed cron jobs
echo -e "\n${YELLOW}Current cron configuration:${NC}"
crontab -l | grep -A 5 "BSE F&O" || echo "No BSE F&O crons found"

# Cleanup
rm -f /tmp/crontab.backup /tmp/crontab.clean /tmp/bse-fo-crons

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   BSE F&O Cron Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${YELLOW}📅 Cron Schedule:${NC}"
echo -e "  - BSE F&O 5-Min Data: Every 5 minutes (9:00 AM - 3:35 PM IST, Mon-Fri)"
echo -e "\n${YELLOW}📝 Logs:${NC}"
echo -e "  - BSE F&O 5-Min: /root/logs/bse-fo-5min-cron.log"
echo -e "\n${YELLOW}🔧 Manual Testing:${NC}"
echo -e "  ${SCRIPTS_DIR}/invoke-bse-fo-5min.sh"
echo -e "\n${YELLOW}📊 Monitor Logs:${NC}"
echo -e "  tail -f /root/logs/bse-fo-5min-cron.log"
echo ""

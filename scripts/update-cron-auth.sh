#!/bin/bash

# Update all cron scripts to use SERVICE_ROLE_KEY instead of ANON_KEY

SCRIPTS_DIR="/root/aigoat/cron-scripts"
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"

echo "Updating cron scripts with SERVICE_ROLE_KEY..."

# 1. NSE Equity 5-Min
cat > "$SCRIPTS_DIR/invoke-nse-equity-5min.sh" << 'EOF'
#!/bin/bash
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"

curl -X POST "${SUPABASE_URL}/functions/v1/nse_equity_historical_5min" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /root/logs/nse-equity-5min-cron.log 2>&1
EOF

# 2. BSE Equity 5-Min
cat > "$SCRIPTS_DIR/invoke-bse-equity-5min.sh" << 'EOF'
#!/bin/bash
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"

curl -X POST "${SUPABASE_URL}/functions/v1/bse_equity_historical_5min" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /root/logs/bse-equity-5min-cron.log 2>&1
EOF

# 3. NSE Swing 1-Hour
cat > "$SCRIPTS_DIR/invoke-nse-swing-1hr.sh" << 'EOF'
#!/bin/bash
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"

curl -X POST "${SUPABASE_URL}/functions/v1/nse_swing_historical_1hr" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 600 \
  >> /root/logs/nse-swing-1hr-cron.log 2>&1
EOF

# 4. BSE Swing 1-Hour
cat > "$SCRIPTS_DIR/invoke-bse-swing-1hr.sh" << 'EOF'
#!/bin/bash
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"

curl -X POST "${SUPABASE_URL}/functions/v1/bse_swing_historical_1hr" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 600 \
  >> /root/logs/bse-swing-1hr-cron.log 2>&1
EOF

# 5. NSE F&O Fetch Contracts
cat > "$SCRIPTS_DIR/invoke-nse-fo-fetch-contracts.sh" << 'EOF'
#!/bin/bash
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"

curl -X POST "${SUPABASE_URL}/functions/v1/nse_fo_fetch_nifty_contracts" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 600 \
  >> /root/logs/nse-fo-fetch-contracts-cron.log 2>&1
EOF

# 6. NSE F&O 5-Min
cat > "$SCRIPTS_DIR/invoke-nse-fo-5min.sh" << 'EOF'
#!/bin/bash
SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"

curl -X POST "${SUPABASE_URL}/functions/v1/nse_fo_historical_5min" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  >> /root/logs/nse-fo-5min-cron.log 2>&1
EOF

# Set executable permissions
chmod +x "$SCRIPTS_DIR"/*.sh

echo "✅ All cron scripts updated with SERVICE_ROLE_KEY"

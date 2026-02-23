#!/bin/bash

# Manual trigger for NSE F&O Historical 5-min data fetch
# This populates the historical_prices_nse_fo table with OHLCV data

SUPABASE_URL="https://kowxpazskkigzwdwzwyq.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"

echo "🚀 Triggering NSE F&O Historical 5-min data fetch..."

curl -X POST "${SUPABASE_URL}/functions/v1/nse_fo_historical_5min" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 600

echo ""
echo "✅ Edge function triggered. Check logs for results."

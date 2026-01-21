#!/bin/bash

# ============================================================================
# Setup Optimized Cron Job for Edge Function
# Purpose: Fetch historical data every 15 minutes (instead of 5)
# Egress savings: 66% reduction
# ============================================================================

echo "🔧 Setting up optimized cron job for Edge Function..."
echo ""

# Get service role key from .env
if [ -f "/root/aigoat/.env" ]; then
    SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /root/aigoat/.env | cut -d'=' -f2)
else
    echo "❌ Error: .env file not found at /root/aigoat/.env"
    exit 1
fi

if [ -z "$SERVICE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env"
    exit 1
fi

# Create cron script
cat > /root/trigger-edge-function.sh << EOF
#!/bin/bash

# Get current time in IST
CURRENT_HOUR=\$(TZ='Asia/Kolkata' date +%H)
CURRENT_MINUTE=\$(TZ='Asia/Kolkata' date +%M)
CURRENT_DAY=\$(TZ='Asia/Kolkata' date +%u)

# Check if market hours (Mon-Fri, 9:05 AM - 6:30 PM IST)
if [ \$CURRENT_DAY -ge 6 ]; then
    exit 0  # Weekend
fi

if [ \$CURRENT_HOUR -lt 9 ] || [ \$CURRENT_HOUR -gt 18 ]; then
    exit 0  # Outside market hours
fi

if [ \$CURRENT_HOUR -eq 9 ] && [ \$CURRENT_MINUTE -lt 5 ]; then
    exit 0  # Before 9:05 AM
fi

if [ \$CURRENT_HOUR -eq 18 ] && [ \$CURRENT_MINUTE -gt 30 ]; then
    exit 0  # After 6:30 PM
fi

# Call Edge Function
curl -X POST "https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action" \\
  -H "Authorization: Bearer $SERVICE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"trigger":"cron","timestamp":"'\$(date -Iseconds)'"}' \\
  >> /root/logs/edge-function.log 2>&1

# Log result
echo "\$(date): Edge function triggered" >> /root/logs/edge-function.log
EOF

# Make script executable
chmod +x /root/trigger-edge-function.sh

# Install cron job (every 15 minutes)
(crontab -l 2>/dev/null | grep -v "trigger-edge-function"; echo "*/15 * * * * /root/trigger-edge-function.sh") | crontab -

echo "✅ Cron job installed!"
echo ""
echo "📊 Configuration:"
echo "   - Frequency: Every 15 minutes"
echo "   - Active hours: 9:05 AM - 6:30 PM IST (Mon-Fri)"
echo "   - Log file: /root/logs/edge-function.log"
echo ""
echo "🧪 Test the script:"
echo "   /root/trigger-edge-function.sh"
echo ""
echo "📋 View cron jobs:"
echo "   crontab -l"
echo ""
echo "📝 View logs:"
echo "   tail -f /root/logs/edge-function.log"
echo ""
echo "💡 Expected egress reduction: 66% (from 2GB to ~0.7GB/day)"

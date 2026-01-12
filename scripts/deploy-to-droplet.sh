#!/bin/bash

# ============================================================================
# Deploy Zerodha Scanners to Digital Ocean Droplet
# Purpose: Deploy all websocket scanners and setup cron jobs
# Run: chmod +x deploy-to-droplet.sh && ./deploy-to-droplet.sh
# ============================================================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║      🚀 DEPLOYING ZERODHA SCANNERS TO DROPLET              ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =================================================================
# Step 1: Check Dependencies
# =================================================================
echo "✅ Step 1: Checking dependencies..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "   ❌ Node.js not found. Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "   ✅ Node.js installed: $(node -v)"
else
    echo "   ✅ Node.js found: $(node -v)"
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "   ❌ PM2 not found. Installing PM2..."
    npm install -g pm2
    pm2 startup
    pm2 save
    echo "   ✅ PM2 installed: $(pm2 -v)"
else
    echo "   ✅ PM2 found: $(pm2 -v)"
fi

echo ""

# =================================================================
# Step 2: Setup Project Directory
# =================================================================
echo "✅ Step 2: Setting up project directory..."

PROJECT_DIR="/root/aigoat"

if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p $PROJECT_DIR
    echo "   📁 Created: $PROJECT_DIR"
else
    echo "   📁 Directory exists: $PROJECT_DIR"
fi

cd $PROJECT_DIR
echo ""

# =================================================================
# Step 3: Copy Scanner Files
# =================================================================
echo "✅ Step 3: Copying scanner files..."

# Create scripts directory
mkdir -p $PROJECT_DIR/scripts

# Copy all scanner files
SCANNERS=(
    "breakout-scanner.js"
    "intraday-bearish-scanner.js"
    "shared-websocket-scanner.js"
    "fetch-historical-cron.sh"
    "setup-cron.sh"
)

for file in "${SCANNERS[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$PROJECT_DIR/scripts/"
        echo "   ✅ Copied: $file"
    else
        echo "   ⚠️  Not found: $file"
    fi
done

# Make shell scripts executable
chmod +x $PROJECT_DIR/scripts/*.sh

echo ""

# =================================================================
# Step 4: Setup Environment Variables
# =================================================================
echo "✅ Step 4: Setting up environment variables..."

# Create .env file
cat > $PROJECT_DIR/.env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://kowxpazskkigzwdwzwyq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4

# Zerodha KiteConnect Configuration
KITE_API_KEY=k6waw89w61osj3t0
KITE_API_SECRET=YOUR_API_SECRET_HERE
KITE_ACCESS_TOKEN=05A9YLfWXmL4mDqu14PRCiV00SHt9p4L

# Edge Function Endpoint
EDGE_FUNCTION_URL=https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action
EOF

echo "   📝 Created: $PROJECT_DIR/.env"
echo "   ⚠️  IMPORTANT: Update KITE_ACCESS_TOKEN daily (expires at 6 AM IST)"
echo ""

# =================================================================
# Step 5: Install Node Dependencies
# =================================================================
echo "✅ Step 5: Installing Node.js dependencies..."

# Create minimal package.json
cat > $PROJECT_DIR/package.json << 'EOF'
{
  "name": "zerodha-scanners",
  "version": "1.0.0",
  "description": "Zerodha KiteConnect websocket scanners for breakout signals",
  "main": "scripts/breakout-scanner.js",
  "scripts": {
    "start:breakout": "node scripts/breakout-scanner.js",
    "start:bearish": "node scripts/intraday-bearish-scanner.js",
    "start:shared": "node scripts/shared-websocket-scanner.js"
  },
  "dependencies": {
    "kiteconnect": "^4.2.1",
    "@supabase/supabase-js": "^2.39.0",
    "dotenv": "^16.3.1"
  }
}
EOF

npm install
echo "   ✅ Dependencies installed"
echo ""

# =================================================================
# Step 6: Setup PM2 Processes
# =================================================================
echo "✅ Step 6: Setting up PM2 processes..."

# Create PM2 ecosystem file
cat > $PROJECT_DIR/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "breakout-scanner",
      script: "./scripts/breakout-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/root/logs/breakout-scanner-error.log",
      out_file: "/root/logs/breakout-scanner-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    },
    {
      name: "intraday-bearish-scanner",
      script: "./scripts/intraday-bearish-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/root/logs/intraday-bearish-error.log",
      out_file: "/root/logs/intraday-bearish-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    },
    {
      name: "shared-websocket-scanner",
      script: "./scripts/shared-websocket-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/root/logs/shared-websocket-error.log",
      out_file: "/root/logs/shared-websocket-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    }
  ]
};
EOF

# Create logs directory
mkdir -p /root/logs

echo "   ✅ PM2 ecosystem config created"
echo ""

# =================================================================
# Step 7: Setup Cron Job for Historical Data Fetch
# =================================================================
echo "✅ Step 7: Setting up cron job for historical data fetch..."

# Run setup-cron.sh
cd $PROJECT_DIR/scripts
./setup-cron.sh

echo ""

# =================================================================
# Step 8: Start Scanners
# =================================================================
echo "✅ Step 8: Starting scanners with PM2..."

cd $PROJECT_DIR

# Stop existing processes if any
pm2 delete all 2>/dev/null || true

# Start all scanners
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

echo "   ✅ All scanners started"
echo ""

# =================================================================
# Step 9: Setup Daily Token Update
# =================================================================
echo "✅ Step 9: Setting up daily token update reminder..."

# Create token update script
cat > /root/update-kite-token.sh << 'EOF'
#!/bin/bash

# ============================================================================
# Update Zerodha KiteConnect Access Token
# Purpose: Update access token daily (expires at 6 AM IST)
# Run: ./update-kite-token.sh YOUR_NEW_ACCESS_TOKEN
# ============================================================================

if [ -z "$1" ]; then
    echo "❌ Usage: ./update-kite-token.sh YOUR_NEW_ACCESS_TOKEN"
    exit 1
fi

NEW_TOKEN="$1"

# Update .env file
cd /root/aigoat
sed -i "s/KITE_ACCESS_TOKEN=.*/KITE_ACCESS_TOKEN=$NEW_TOKEN/" .env

echo "✅ Token updated in .env file"

# Restart all scanners
pm2 restart all

echo "✅ All scanners restarted with new token"
echo ""
echo "📊 Scanner status:"
pm2 status
EOF

chmod +x /root/update-kite-token.sh

echo "   ✅ Token update script created: /root/update-kite-token.sh"
echo ""

# =================================================================
# Summary
# =================================================================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║      ✅ DEPLOYMENT COMPLETE!                              ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Deployment Summary:"
echo "   • Project Directory:  /root/aigoat"
echo "   • Scanner Count:      3 (breakout, bearish, shared)"
echo "   • Cron Job:           Historical data fetch (every 5 min)"
echo "   • Process Manager:    PM2"
echo "   • Logs Directory:     /root/logs"
echo ""
echo "🎯 Scanner Status:"
pm2 status
echo ""
echo "📋 Cron Jobs:"
crontab -l | grep "fetch-historical"
echo ""
echo "🔧 Useful Commands:"
echo "   • View logs:          pm2 logs [scanner-name]"
echo "   • Restart scanner:    pm2 restart [scanner-name]"
echo "   • Stop all:           pm2 stop all"
echo "   • Update token:       /root/update-kite-token.sh NEW_TOKEN"
echo "   • Test cron:          /root/fetch-historical-cron.sh"
echo ""
echo "⚠️  IMPORTANT REMINDERS:"
echo "   1. Update KITE_ACCESS_TOKEN daily before 6 AM IST"
echo "   2. Access token expires every day at 6 AM IST"
echo "   3. Use /root/update-kite-token.sh to update token"
echo "   4. Monitor PM2 logs for any connection issues"
echo ""
echo "🎉 Your Zerodha scanners are now running on Digital Ocean!"

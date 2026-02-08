#!/bin/bash

# ============================================================================
# Deploy NSE & BSE Equity Scanners to Digital Ocean Droplet
# Purpose: Deploy nse-equity-scanner.js and bse-equity-scanner.js
# Usage: ./deploy-equity-scanners.sh <DROPLET_IP>
# Example: ./deploy-equity-scanners.sh 143.244.129.143
# ============================================================================

set -e  # Exit on any error

DROPLET_IP="${1:-143.244.129.143}"
DROPLET_USER="root"
DROPLET_PATH="/root/aigoat"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║      🚀 DEPLOYING EQUITY SCANNERS TO DROPLET              ║"
echo "║         Target: $DROPLET_IP                                 ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =================================================================
# Step 1: Verify Files Exist Locally
# =================================================================
echo "✅ Step 1: Verifying local files..."

LOCAL_FILES=(
    "scripts/nse-equity-scanner.js"
    "scripts/bse-equity-scanner.js"
    "scripts/pattern-detector.js"
    "scripts/utils/database-client.js"
    "scripts/utils/indicators.js"
    "scripts/utils/monitor.js"
    "scripts/utils/ai-breakout-filter.js"
)

for file in "${LOCAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ Found: $file"
    else
        echo "   ❌ Missing: $file"
        exit 1
    fi
done

echo ""

# =================================================================
# Step 2: Create Temporary Deployment Package
# =================================================================
echo "✅ Step 2: Creating deployment package..."

TEMP_DIR=$(mktemp -d)
echo "   📁 Temp directory: $TEMP_DIR"

# Copy scanner files
mkdir -p "$TEMP_DIR/scripts/utils"
cp scripts/nse-equity-scanner.js "$TEMP_DIR/scripts/"
cp scripts/bse-equity-scanner.js "$TEMP_DIR/scripts/"
cp scripts/pattern-detector.js "$TEMP_DIR/scripts/"
cp scripts/utils/*.js "$TEMP_DIR/scripts/utils/"

echo "   ✅ Files copied to temp directory"
echo ""

# =================================================================
# Step 3: Cleanup Old Files on Droplet
# =================================================================
echo "✅ Step 3: Cleaning up old files on droplet..."

ssh "$DROPLET_USER@$DROPLET_IP" bash << 'REMOTE_CLEANUP'
cd /root/aigoat/scripts

# Remove old breakout scanner file
if [ -f "breakout-scanner.js" ]; then
    echo "   🗑️  Removing old breakout-scanner.js"
    rm -f breakout-scanner.js
fi

# Backup memory-cache.js if it exists
if [ -f "memory-cache.js" ]; then
    echo "   📦 Backing up memory-cache.js"
    cp memory-cache.js memory-cache.js.backup
fi

echo "   ✅ Cleanup complete"

REMOTE_CLEANUP

echo ""

# =================================================================
# Step 4: Upload Files to Droplet
# =================================================================
echo "✅ Step 4: Uploading files to droplet..."

# Create remote directories
ssh "$DROPLET_USER@$DROPLET_IP" "mkdir -p $DROPLET_PATH/scripts/utils"

# Upload scanner files
scp "$TEMP_DIR/scripts/nse-equity-scanner.js" "$DROPLET_USER@$DROPLET_IP:$DROPLET_PATH/scripts/"
scp "$TEMP_DIR/scripts/bse-equity-scanner.js" "$DROPLET_USER@$DROPLET_IP:$DROPLET_PATH/scripts/"
scp "$TEMP_DIR/scripts/pattern-detector.js" "$DROPLET_USER@$DROPLET_IP:$DROPLET_PATH/scripts/"
scp "$TEMP_DIR/scripts/utils/"*.js "$DROPLET_USER@$DROPLET_IP:$DROPLET_PATH/scripts/utils/"

echo "   ✅ Files uploaded successfully"
echo ""

# Cleanup temp directory
rm -rf "$TEMP_DIR"

# =================================================================
# Step 5: Update PM2 Ecosystem Configuration
# =================================================================
echo "✅ Step 5: Updating PM2 configuration on droplet..."

ssh "$DROPLET_USER@$DROPLET_IP" bash << 'REMOTE_SCRIPT'

cd /root/aigoat

# Backup existing ecosystem config
if [ -f ecosystem.config.js ]; then
    cp ecosystem.config.js ecosystem.config.js.backup
    echo "   ✅ Backed up existing PM2 config"
fi

# Create/Update PM2 ecosystem file with equity scanners
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "nse-equity-scanner",
      script: "./scripts/nse-equity-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/root/logs/nse-equity-error.log",
      out_file: "/root/logs/nse-equity-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    },
    {
      name: "bse-equity-scanner",
      script: "./scripts/bse-equity-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/root/logs/bse-equity-error.log",
      out_file: "/root/logs/bse-equity-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    }
  ]
};
EOF

# Create logs directory
mkdir -p /root/logs

echo "   ✅ PM2 ecosystem config updated"

REMOTE_SCRIPT

echo ""

# =================================================================
# Step 6: Install Dependencies on Droplet
# =================================================================
echo "✅ Step 6: Installing dependencies on droplet..."

ssh "$DROPLET_USER@$DROPLET_IP" bash << 'REMOTE_SCRIPT'

cd /root/aigoat

# Check if package.json exists
if [ ! -f package.json ]; then
    echo "   ⚠️  Creating minimal package.json..."
    cat > package.json << 'EOF'
{
  "name": "aigoat-equity-scanners",
  "version": "1.0.0",
  "description": "NSE & BSE Equity Breakout Scanners",
  "main": "scripts/nse-equity-scanner.js",
  "scripts": {
    "start:nse": "node scripts/nse-equity-scanner.js",
    "start:bse": "node scripts/bse-equity-scanner.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "dotenv": "^16.4.0"
  }
}
EOF
fi

# Install dependencies
npm install

echo "   ✅ Dependencies installed"

REMOTE_SCRIPT

echo ""

# =================================================================
# Step 7: Restart PM2 Scanners
# =================================================================
echo "✅ Step 7: Restarting scanners with PM2..."

ssh "$DROPLET_USER@$DROPLET_IP" bash << 'REMOTE_SCRIPT'

cd /root/aigoat

# Delete existing equity scanners if running
pm2 delete nse-equity-scanner 2>/dev/null || true
pm2 delete bse-equity-scanner 2>/dev/null || true

# Start equity scanners
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

echo "   ✅ Equity scanners started"
echo ""
echo "   📊 Scanner Status:"
pm2 status

REMOTE_SCRIPT

echo ""

# =================================================================
# Step 8: Display Scanner Logs
# =================================================================
echo "✅ Step 8: Displaying initial logs..."

ssh "$DROPLET_USER@$DROPLET_IP" "pm2 logs --lines 20 --nostream"

echo ""

# =================================================================
# Summary
# =================================================================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║      ✅ EQUITY SCANNERS DEPLOYMENT COMPLETE!             ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Deployment Summary:"
echo "   • Droplet IP:         $DROPLET_IP"
echo "   • Project Directory:  /root/aigoat"
echo "   • Scanners Deployed:  2 (NSE & BSE Equity)"
echo "   • Process Manager:    PM2"
echo "   • Logs Directory:     /root/logs"
echo ""
echo "🔧 Useful Commands (run on droplet):"
echo "   • View logs:          pm2 logs nse-equity-scanner"
echo "   • View logs:          pm2 logs bse-equity-scanner"
echo "   • Restart NSE:        pm2 restart nse-equity-scanner"
echo "   • Restart BSE:        pm2 restart bse-equity-scanner"
echo "   • Stop all:           pm2 stop all"
echo "   • Scanner status:     pm2 status"
echo ""
echo "🎯 Monitor Your Scanners:"
echo "   ssh $DROPLET_USER@$DROPLET_IP"
echo "   pm2 monit"
echo ""
echo "⚠️  IMPORTANT REMINDERS:"
echo "   1. Ensure .env file has valid KITE_ACCESS_TOKEN"
echo "   2. Ensure .env file has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
echo "   3. Access token expires daily at 6 AM IST"
echo "   4. Monitor PM2 logs for connection issues"
echo ""
echo "🎉 Your equity scanners are now running on Digital Ocean!"

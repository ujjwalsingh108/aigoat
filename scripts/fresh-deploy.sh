#!/bin/bash

# ============================================================================
# Fresh Droplet Deployment Script (2026 - With Cache)
# Purpose: Deploy breakout scanner with in-memory caching from scratch
# Usage: ./fresh-deploy.sh
# ============================================================================

set -e  # Exit on any error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🚀 FRESH DROPLET DEPLOYMENT - AIGOAT SCANNER            ║"
echo "║      With In-Memory Caching Enabled                        ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =================================================================
# Step 1: System Update
# =================================================================
echo "📦 Step 1: Updating system packages..."
apt-get update -y > /dev/null 2>&1
apt-get upgrade -y > /dev/null 2>&1
apt-get install -y curl wget git vim nano build-essential > /dev/null 2>&1
echo "   ✅ System updated"
echo ""

# =================================================================
# Step 2: Install Node.js 20.x
# =================================================================
echo "🟢 Step 2: Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
    echo "   ✅ Node.js installed: $(node -v)"
else
    NODE_VERSION=$(node -v)
    echo "   ✅ Node.js already installed: $NODE_VERSION"
fi
echo ""

# =================================================================
# Step 3: Install PM2
# =================================================================
echo "⚙️  Step 3: Installing PM2 process manager..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
    echo "   ✅ PM2 installed: $(pm2 -v)"
    
    # Setup PM2 startup
    pm2 startup > /tmp/pm2-startup.txt 2>&1
    STARTUP_CMD=$(grep "sudo env" /tmp/pm2-startup.txt || true)
    if [ ! -z "$STARTUP_CMD" ]; then
        eval $STARTUP_CMD > /dev/null 2>&1
        echo "   ✅ PM2 startup configured"
    fi
else
    echo "   ✅ PM2 already installed: $(pm2 -v)"
fi
echo ""

# =================================================================
# Step 4: Create Project Structure
# =================================================================
echo "📁 Step 4: Creating project directories..."
mkdir -p /root/aigoat/scripts
mkdir -p /root/logs
echo "   ✅ Created /root/aigoat/scripts"
echo "   ✅ Created /root/logs"
echo ""

# =================================================================
# Step 5: Check Required Files
# =================================================================
echo "📄 Step 5: Checking required files..."
REQUIRED_FILES=(
    "/tmp/breakout-scanner.js"
    "/tmp/memory-cache.js"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "   ❌ Missing required files in /tmp/:"
    for file in "${MISSING_FILES[@]}"; do
        echo "      - $(basename $file)"
    done
    echo ""
    echo "📝 Please upload files first using SCP:"
    echo "   scp scripts/breakout-scanner.js root@YOUR_DROPLET:/tmp/"
    echo "   scp scripts/memory-cache.js root@YOUR_DROPLET:/tmp/"
    echo ""
    exit 1
fi

# Copy files to project directory
cp /tmp/breakout-scanner.js /root/aigoat/scripts/
cp /tmp/memory-cache.js /root/aigoat/scripts/
echo "   ✅ Copied breakout-scanner.js"
echo "   ✅ Copied memory-cache.js"
echo ""

# =================================================================
# Step 6: Create package.json
# =================================================================
echo "📦 Step 6: Creating package.json..."
cat > /root/aigoat/package.json << 'EOF'
{
  "name": "aigoat-scanner",
  "version": "1.0.0",
  "description": "Zerodha breakout scanner with caching",
  "main": "scripts/breakout-scanner.js",
  "scripts": {
    "start": "pm2 start ecosystem.config.js"
  },
  "dependencies": {
    "kiteconnect": "^5.1.0",
    "@supabase/supabase-js": "^2.81.1",
    "dotenv": "^17.2.3"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
EOF
echo "   ✅ package.json created"
echo ""

# =================================================================
# Step 7: Install Dependencies
# =================================================================
echo "📚 Step 7: Installing npm dependencies..."
cd /root/aigoat
npm install > /dev/null 2>&1
echo "   ✅ Dependencies installed"
echo ""

# =================================================================
# Step 8: Create Environment File
# =================================================================
echo "🔐 Step 8: Creating environment file..."
if [ -f "/root/aigoat/.env" ]; then
    echo "   ⚠️  .env file already exists, skipping..."
else
    cat > /root/aigoat/.env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://kowxpazskkigzwdwzwyq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# Zerodha KiteConnect Configuration
KITE_API_KEY=k6waw89w61osj3t0
KITE_API_SECRET=YOUR_API_SECRET_HERE
KITE_ACCESS_TOKEN=YOUR_DAILY_TOKEN_HERE
EOF
    chmod 600 /root/aigoat/.env
    echo "   ✅ .env file created"
    echo "   ⚠️  IMPORTANT: Edit /root/aigoat/.env with your actual credentials!"
fi
echo ""

# =================================================================
# Step 9: Create PM2 Ecosystem
# =================================================================
echo "⚙️  Step 9: Creating PM2 ecosystem config..."
cat > /root/aigoat/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "breakout-scanner",
      script: "./scripts/breakout-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "/root/logs/breakout-scanner-error.log",
      out_file: "/root/logs/breakout-scanner-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
    },
  ],
};
EOF
echo "   ✅ ecosystem.config.js created"
echo ""

# =================================================================
# Step 10: Create Helper Scripts
# =================================================================
echo "🛠️  Step 10: Creating helper scripts..."

# Token update script
cat > /root/update-kite-token.sh << 'EOF'
#!/bin/bash
NEW_TOKEN=$1
if [ -z "$NEW_TOKEN" ]; then
    echo "❌ Error: No token provided"
    echo "Usage: ./update-kite-token.sh YOUR_NEW_TOKEN"
    exit 1
fi
sed -i "s/^KITE_ACCESS_TOKEN=.*/KITE_ACCESS_TOKEN=$NEW_TOKEN/" /root/aigoat/.env
pm2 restart breakout-scanner
echo "✅ Token updated and scanner restarted"
pm2 logs breakout-scanner --lines 10 --nostream
EOF
chmod +x /root/update-kite-token.sh
echo "   ✅ Created /root/update-kite-token.sh"

# Status check script
cat > /root/check-status.sh << 'EOF'
#!/bin/bash
echo "========================================"
echo "📊 SCANNER STATUS"
echo "========================================"
pm2 status
echo ""
echo "📈 MEMORY USAGE"
free -h
echo ""
echo "💾 DISK SPACE"
df -h | grep -E "/$|/root"
echo ""
echo "📝 RECENT LOGS (Last 10 lines)"
echo "========================================"
pm2 logs breakout-scanner --lines 10 --nostream
EOF
chmod +x /root/check-status.sh
echo "   ✅ Created /root/check-status.sh"
echo ""

# =================================================================
# Step 11: Configure Firewall
# =================================================================
echo "🔥 Step 11: Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw --force enable > /dev/null 2>&1
    ufw allow 22/tcp > /dev/null 2>&1
    echo "   ✅ Firewall enabled (SSH only)"
else
    echo "   ⚠️  UFW not available, skipping..."
fi
echo ""

# =================================================================
# Final Messages
# =================================================================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   ✅ DEPLOYMENT COMPLETE!                                  ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. ✏️  Edit credentials:"
echo "   nano /root/aigoat/.env"
echo ""
echo "2. 🚀 Start scanner:"
echo "   cd /root/aigoat"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo ""
echo "3. 📊 Check status:"
echo "   pm2 status"
echo "   pm2 logs breakout-scanner"
echo ""
echo "4. ✅ Verify:"
echo "   /root/check-status.sh"
echo ""
echo "📝 Helper Scripts:"
echo "   - Update token: /root/update-kite-token.sh YOUR_TOKEN"
echo "   - Check status: /root/check-status.sh"
echo ""
echo "📚 Full Documentation:"
echo "   - docs/FRESH-DROPLET-DEPLOYMENT.md"
echo "   - docs/QUICK-DEPLOYMENT.md"
echo ""
echo "🎉 Happy Trading!"
echo ""

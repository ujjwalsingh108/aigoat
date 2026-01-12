# Digital Ocean Droplet Deployment Guide

Complete guide for deploying Zerodha KiteConnect websocket scanners to Digital Ocean droplet.

---

## 🎯 Overview

This deployment sets up:
1. **3 Websocket Scanners** (PM2 managed):
   - `breakout-scanner.js` - Bullish breakout detection
   - `intraday-bearish-scanner.js` - Bearish opportunity detection
   - `shared-websocket-scanner.js` - Combined scanner
2. **Cron Job**: Triggers Supabase Edge Function every 5 minutes for historical data fetch
3. **Auto-restart**: PM2 ensures scanners restart on crash/reboot
4. **Logging**: Centralized logs in `/root/logs/`

---

## 📋 Prerequisites

### 1. Digital Ocean Droplet
- **OS**: Ubuntu 20.04+ LTS
- **Memory**: Minimum 2GB RAM (4GB recommended for 1000 stocks)
- **vCPUs**: 2+ cores recommended
- **Storage**: 50GB SSD

### 2. Required Credentials
```bash
# Zerodha KiteConnect
KITE_API_KEY=k6waw89w61osj3t0
KITE_API_SECRET=<your_secret>
KITE_ACCESS_TOKEN=<daily_token>  # Expires at 6 AM IST

# Supabase
SUPABASE_URL=https://kowxpazskkigzwdwzwyq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_key>

# Edge Function
EDGE_FUNCTION_URL=https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action
```

---

## 🚀 Deployment Steps

### Option 1: Automated Deployment (Recommended)

```bash
# SSH into your droplet
ssh root@your_droplet_ip

# Clone or upload your project files
# If using git:
git clone https://github.com/ujjwalsingh108/aigoat.git /tmp/aigoat
cd /tmp/aigoat/scripts

# If uploading files:
# scp -r scripts/ root@your_droplet_ip:/tmp/aigoat/

# Run deployment script
chmod +x deploy-to-droplet.sh
./deploy-to-droplet.sh
```

The script will:
- ✅ Install Node.js 20.x
- ✅ Install PM2 process manager
- ✅ Copy scanner files to `/root/aigoat`
- ✅ Install npm dependencies (kiteconnect, @supabase/supabase-js)
- ✅ Setup environment variables
- ✅ Configure PM2 ecosystem
- ✅ Setup cron job for historical data fetch
- ✅ Start all scanners
- ✅ Save PM2 configuration

---

### Option 2: Manual Deployment

#### Step 1: Install Dependencies
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2
pm2 startup
pm2 save
```

#### Step 2: Setup Project
```bash
# Create project directory
mkdir -p /root/aigoat/scripts
cd /root/aigoat

# Upload scanner files (from your local machine)
scp scripts/*.js root@your_droplet_ip:/root/aigoat/scripts/
scp scripts/*.sh root@your_droplet_ip:/root/aigoat/scripts/

# Make scripts executable
chmod +x /root/aigoat/scripts/*.sh
```

#### Step 3: Configure Environment
```bash
# Create .env file
cat > /root/aigoat/.env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://kowxpazskkigzwdwzwyq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_KEY>

# Zerodha KiteConnect Configuration
KITE_API_KEY=k6waw89w61osj3t0
KITE_API_SECRET=<YOUR_API_SECRET>
KITE_ACCESS_TOKEN=<YOUR_DAILY_TOKEN>

# Edge Function Endpoint
EDGE_FUNCTION_URL=https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action
EOF
```

#### Step 4: Install Node Modules
```bash
cd /root/aigoat

# Create package.json
npm init -y

# Install dependencies
npm install kiteconnect@^4.2.1 @supabase/supabase-js@^2.39.0 dotenv@^16.3.1
```

#### Step 5: Configure PM2
```bash
# Create PM2 ecosystem file
cat > /root/aigoat/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "breakout-scanner",
      script: "./scripts/breakout-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "/root/logs/breakout-scanner-error.log",
      out_file: "/root/logs/breakout-scanner-out.log"
    },
    {
      name: "intraday-bearish-scanner",
      script: "./scripts/intraday-bearish-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "/root/logs/intraday-bearish-error.log",
      out_file: "/root/logs/intraday-bearish-out.log"
    },
    {
      name: "shared-websocket-scanner",
      script: "./scripts/shared-websocket-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "/root/logs/shared-websocket-error.log",
      out_file: "/root/logs/shared-websocket-out.log"
    }
  ]
};
EOF

# Create logs directory
mkdir -p /root/logs
```

#### Step 6: Setup Cron Job
```bash
cd /root/aigoat/scripts
./setup-cron.sh
```

#### Step 7: Start Scanners
```bash
cd /root/aigoat
pm2 start ecosystem.config.js
pm2 save
```

---

## 🔧 Configuration

### PM2 Ecosystem Structure
```javascript
/root/aigoat/
├── .env                          # Environment variables
├── package.json                  # Node dependencies
├── ecosystem.config.js           # PM2 configuration
├── node_modules/                 # Installed packages
└── scripts/
    ├── breakout-scanner.js       # Bullish scanner
    ├── intraday-bearish-scanner.js  # Bearish scanner
    ├── shared-websocket-scanner.js  # Combined scanner
    ├── fetch-historical-cron.sh  # Cron script
    └── setup-cron.sh             # Cron setup script
```

### Cron Job Schedule
```bash
# Runs every 5 minutes during market hours (9:05 AM - 6:30 PM IST, Mon-Fri)
*/5 * * * * /root/fetch-historical-cron.sh > /dev/null 2>&1
```

---

## 📊 Monitoring & Management

### Check Scanner Status
```bash
# View all processes
pm2 status

# View detailed info
pm2 info breakout-scanner
```

### View Logs
```bash
# Real-time logs for all scanners
pm2 logs

# Specific scanner logs
pm2 logs breakout-scanner
pm2 logs intraday-bearish-scanner
pm2 logs shared-websocket-scanner

# View log files directly
tail -f /root/logs/breakout-scanner-out.log
tail -f /root/logs/breakout-scanner-error.log
```

### Restart Scanners
```bash
# Restart all
pm2 restart all

# Restart specific scanner
pm2 restart breakout-scanner

# Reload (zero-downtime)
pm2 reload all
```

### Stop Scanners
```bash
# Stop all
pm2 stop all

# Stop specific scanner
pm2 stop breakout-scanner

# Delete process
pm2 delete breakout-scanner
```

---

## 🔄 Daily Token Update

**CRITICAL**: Zerodha access tokens expire **daily at 6 AM IST**. You must update the token before market hours.

### Method 1: Using Update Script (Recommended)
```bash
# Create the update script (included in deploy-to-droplet.sh)
/root/update-kite-token.sh YOUR_NEW_ACCESS_TOKEN
```

### Method 2: Manual Update
```bash
# SSH into droplet
ssh root@your_droplet_ip

# Update .env file
cd /root/aigoat
nano .env  # Update KITE_ACCESS_TOKEN value

# Restart all scanners
pm2 restart all
```

### Method 3: Automated Token Update (Advanced)
You can automate token generation using Zerodha's login flow:
```bash
# Create automated token refresh script
# Requires: Selenium/Puppeteer + your login credentials
# See: https://kite.trade/docs/connect/v3/user/#token-expiry
```

---

## 🐛 Troubleshooting

### Scanner Not Starting
```bash
# Check PM2 logs
pm2 logs breakout-scanner --lines 100

# Common issues:
# 1. Invalid access token → Update token
# 2. Missing dependencies → Run: npm install
# 3. Wrong directory → Check cwd in ecosystem.config.js
```

### No Ticks Received
```bash
# Check if token is valid
# Check KiteTicker connection in logs
pm2 logs breakout-scanner | grep "KiteTicker"

# Expected output:
# ✅ KiteTicker connected successfully
# 📡 Subscribing to 1000 instrument tokens...
# 📡 First tick received: {...}
```

### Cron Job Not Running
```bash
# Verify cron is installed
crontab -l | grep "fetch-historical"

# Test manual execution
/root/fetch-historical-cron.sh

# Check market hours (must be 9:05 AM - 6:30 PM IST, Mon-Fri)
TZ='Asia/Kolkata' date
```

### High Memory Usage
```bash
# Check memory usage
pm2 monit

# Reduce TOP_N_STOCKS in scanner config
# Or increase droplet memory to 4GB+

# Restart with memory limit
pm2 restart breakout-scanner --max-memory-restart 500M
```

### Database Connection Issues
```bash
# Test Supabase connection
curl -H "apikey: YOUR_SERVICE_KEY" \
  https://kowxpazskkigzwdwzwyq.supabase.co/rest/v1/zerodha_symbols?limit=1

# Check .env file
cat /root/aigoat/.env | grep SUPABASE
```

---

## 🎯 Performance Optimization

### For 1000 Stocks:
```bash
# Recommended droplet size:
# - 4GB RAM
# - 2 vCPUs
# - 80GB SSD

# Optimize PM2 config:
max_memory_restart: "1G"  # Per scanner
instances: 1              # Don't cluster (WebSocket limitation)
```

### For 500 Stocks:
```bash
# Minimum droplet size:
# - 2GB RAM
# - 1 vCPU
# - 50GB SSD

# Update scanner config:
TOP_N_STOCKS: 500  # In each scanner file
```

---

## 🔒 Security Best Practices

1. **Firewall**: Only allow SSH (port 22)
```bash
ufw allow 22
ufw enable
```

2. **SSH Key**: Disable password authentication
```bash
# Edit /etc/ssh/sshd_config
PasswordAuthentication no
service ssh restart
```

3. **Environment Variables**: Never commit .env to git
```bash
# Add to .gitignore
echo ".env" >> /root/aigoat/.gitignore
```

4. **Service Role Key**: Use Supabase RLS policies
```sql
-- Restrict access to breakout_signals table
CREATE POLICY "Service role only" ON breakout_signals
  FOR ALL TO service_role USING (true);
```

---

## 📈 Monitoring Dashboard

### PM2 Plus (Optional - Free Tier)
```bash
# Register at https://app.pm2.io
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY

# Benefits:
# - Web dashboard
# - Email alerts
# - Performance metrics
# - Error tracking
```

### Supabase Dashboard
Monitor edge function calls and database writes:
- Edge Function logs: https://supabase.com/dashboard/project/kowxpazskkigzwdwzwyq/functions/hyper-action/logs
- Database activity: https://supabase.com/dashboard/project/kowxpazskkigzwdwzwyq/database/tables

---

## 🎉 Success Indicators

Your deployment is successful when you see:

1. **PM2 Status**: All 3 scanners "online"
```bash
pm2 status
# Expected:
# breakout-scanner          │ online │ ...
# intraday-bearish-scanner  │ online │ ...
# shared-websocket-scanner  │ online │ ...
```

2. **Scanner Logs**: Receiving ticks
```bash
pm2 logs breakout-scanner --lines 20
# Expected:
# ✅ KiteTicker connected successfully
# 📡 Subscribing to 1000 instrument tokens...
# 📡 First tick received: {...}
# ✅ Receiving ticks: 1000 symbols
```

3. **Cron Execution**: Edge function called every 5 min
```bash
# Check Supabase Edge Function logs
# Should see POST requests every 5 minutes during market hours
```

4. **Database**: New signals saved
```sql
-- Check in Supabase SQL Editor
SELECT COUNT(*) FROM breakout_signals 
WHERE created_at > NOW() - INTERVAL '1 hour';
-- Should return > 0 if market is open
```

---

## 📞 Support

### Logs to Share for Debugging
```bash
# Collect debug info
pm2 logs --lines 100 > /tmp/pm2-logs.txt
crontab -l > /tmp/crontab.txt
pm2 status > /tmp/pm2-status.txt
cat /root/aigoat/.env > /tmp/env-config.txt  # Remove sensitive keys before sharing!

# Download from droplet
scp root@your_droplet_ip:/tmp/*.txt ./
```

---

## ✅ Deployment Checklist

- [ ] Droplet created (2GB+ RAM, Ubuntu 20.04+)
- [ ] SSH access configured
- [ ] deploy-to-droplet.sh uploaded and executed
- [ ] .env file updated with valid credentials
- [ ] PM2 shows all 3 scanners "online"
- [ ] Scanner logs show "KiteTicker connected"
- [ ] Scanner logs show "Receiving ticks: 1000 symbols"
- [ ] Cron job installed (check: `crontab -l`)
- [ ] Test cron: `/root/fetch-historical-cron.sh` (during market hours)
- [ ] Database shows new breakout_signals entries
- [ ] Token update script created: `/root/update-kite-token.sh`
- [ ] Calendar reminder set for daily token updates (before 6 AM IST)

---

**🎉 Congratulations!** Your Zerodha scanners are now running 24/7 on Digital Ocean, monitoring 1000 NSE stocks and saving signals to Supabase!

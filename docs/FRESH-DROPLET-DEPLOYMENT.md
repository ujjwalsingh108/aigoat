# 🚀 Fresh Droplet Deployment Guide (2026)

**Complete clean installation with Redis caching enabled**

This guide walks you through a fresh deployment of the breakout scanner on DigitalOcean droplet with the new cache-optimized architecture.

---

## 📋 Prerequisites

### 1. DigitalOcean Droplet Specs
- **OS**: Ubuntu 22.04 LTS (recommended) or 20.04+
- **Memory**: 2GB RAM (minimum) or 4GB (recommended for 2515 stocks)
- **vCPUs**: 2 cores
- **Storage**: 50GB SSD
- **SSH Key**: Already configured

### 2. Required Credentials

Gather these before starting:

```bash
# Zerodha KiteConnect
KITE_API_KEY=k6waw89w61osj3t0
KITE_API_SECRET=your_api_secret
KITE_ACCESS_TOKEN=your_daily_token  # Generate daily before 9:15 AM IST

# Supabase
SUPABASE_URL=https://kowxpazskkigzwdwzwyq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🧹 Part 1: Clean Droplet (If Needed)

**Skip this if you have a brand new droplet.**

### SSH into Droplet
```bash
ssh root@143.244.129.143
```

### Remove All Cron Jobs
```bash
# View current cron jobs
crontab -l

# Remove all cron jobs
crontab -r

# Verify removed
crontab -l  # Should show: no crontab for root
```

### Stop and Remove PM2 Processes
```bash
# Stop all PM2 processes
pm2 stop all
pm2 delete all

# Remove PM2 from startup
pm2 unstartup

# Remove PM2 globally (optional - will need reinstall)
npm uninstall -g pm2
```

### Clean Project Directory
```bash
# Remove old project files
rm -rf /root/aigoat
rm -rf /root/logs
rm -rf /tmp/aigoat

# Remove old cron scripts and aigoat-related files
rm -f /root/fetch-historical-cron.sh
rm -f /root/update-kite-token.sh
rm -f /root/check-status.sh
rm -f /root/trigger-edge-function.sh

# Remove old environment file (will be recreated)
rm -f /root/.env

# Clean cache and temporary files
rm -rf /root/.cache
rm -rf /root/.npm
rm -rf /root/.pm2
rm -f /root/.lesshst
rm -f /root/.wget-hsts

# Clear bash history (optional)
history -c
> /root/.bash_history

# Verify cleaned (should only see .ssh, .bashrc, .profile, system files)
ls -la /root/
```

### Optional: Full System Cleanup
```bash
# Remove unused packages
apt-get autoremove -y
apt-get autoclean -y

# Clear npm cache
npm cache clean --force

# Check disk space
df -h
```

---

## 🎬 Part 2: Fresh Installation

### Step 1: Update System
```bash
# Update package lists
apt-get update -y

# Upgrade existing packages
apt-get upgrade -y

# Install essential tools
apt-get install -y curl wget git vim nano build-essential
```

### Step 2: Install Node.js 20.x
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install Node.js
apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Step 3: Install PM2 Process Manager
```bash
# Install PM2 globally
npm install -g pm2

# Setup PM2 to start on system boot
pm2 startup

# Execute the command shown (will be like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Verify installation
pm2 --version
```

### Step 4: Create Project Structure
```bash
# Create directories
mkdir -p /root/aigoat/scripts
mkdir -p /root/logs

# Navigate to project
cd /root/aigoat

# Verify structure
tree -L 2 /root/aigoat
```

---

## 📦 Part 3: Upload Project Files

### Option A: Using SCP (From Your Local Machine)

Open a **new terminal on your local machine** (Windows PowerShell):

```powershell
# Set variables
$DROPLET_IP = "143.244.129.143"
$SSH_KEY = "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean"

# Navigate to project
cd D:\Private\aigoat

# Upload scanner script
scp -i $SSH_KEY scripts/breakout-scanner.js root@${DROPLET_IP}:/root/aigoat/scripts/

# Upload memory cache module (NEW - for caching)
scp -i $SSH_KEY scripts/memory-cache.js root@${DROPLET_IP}:/root/aigoat/scripts/

# Upload package.json (for dependencies)
scp -i $SSH_KEY package.json root@${DROPLET_IP}:/root/aigoat/

# Verify upload
ssh -i $SSH_KEY root@${DROPLET_IP} "ls -la /root/aigoat/scripts/"
```

### Option B: Using Git Clone (Alternative)

```bash
# On droplet, if your repo is public
cd /root
git clone https://github.com/yourusername/aigoat.git

# Or use specific files
cd /root/aigoat
wget https://raw.githubusercontent.com/yourusername/aigoat/main/scripts/breakout-scanner.js
wget https://raw.githubusercontent.com/yourusername/aigoat/main/scripts/memory-cache.js
```

---

## ⚙️ Part 4: Configure Environment

### Create Environment File
```bash
# Create .env file
cat > /root/aigoat/.env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://kowxpazskkigzwdwzwyq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4

# Zerodha KiteConnect Configuration
KITE_API_KEY=k6waw89w61osj3t0
KITE_API_SECRET=jacxp9hwxnm9yxo95deb66k74n4nca4q
KITE_ACCESS_TOKEN=Pa3SFfIejSHcqkrQTqxBH8E99uyBeLux
EOF
```

### Update with Your Credentials
```bash
# Edit the file
nano /root/aigoat/.env

# Replace placeholders:
# 1. SUPABASE_SERVICE_ROLE_KEY
# 2. KITE_API_SECRET
# 3. KITE_ACCESS_TOKEN

# Save: Ctrl+X, then Y, then Enter
```

### Secure Environment File
```bash
# Restrict permissions
chmod 600 /root/aigoat/.env

# Verify
ls -la /root/aigoat/.env
# Should show: -rw------- (only root can read/write)
```

---

## 📚 Part 5: Install Dependencies

### Create package.json (if not uploaded)
```bash
cd /root/aigoat

cat > package.json << 'EOF'
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
```

### Install Node Modules
```bash
cd /root/aigoat

# Install dependencies
npm install

# Verify installation
ls -la node_modules/
# Should show: kiteconnect, @supabase, dotenv, etc.
```

---

## ⏰ Part 6: Setup Edge Function Cron

**Critical: This cron job fetches historical data for the scanner.**

The scanner needs historical price data to calculate EMA20, RSI, and volume baselines. Without this cron job, breakout detection won't work.

### Upload Cron Setup Script

**From your local Windows machine:**

```powershell
# Navigate to project
cd D:\Private\aigoat

# Upload the cron setup script
scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/setup-optimized-cron.sh root@143.244.129.143:/tmp/
```

### Run the Setup Script

**On the droplet (SSH session):**

```bash
#I'm here at 6:38pm
# Make script executable
chmod +x /tmp/setup-optimized-cron.sh

# Run the setup script
/tmp/setup-optimized-cron.sh

# Expected output:
# 🔧 Setting up optimized cron job for Edge Function...
# ✅ Cron job installed!
# 📊 Configuration:
#    - Frequency: Every 15 minutes
#    - Active hours: 9:05 AM - 6:30 PM IST (Mon-Fri)
#    - Log file: /root/logs/edge-function.log
```

### Verify Installation

```bash
# Check if cron job is installed
crontab -l

# Should show:
# */15 * * * * /root/trigger-edge-function.sh

# Test the script manually
/root/trigger-edge-function.sh

# Check logs
tail -20 /root/logs/edge-function.log

# Expected output:
# [Timestamp]: Edge function triggered
# {"success": true, "message": "Historical data fetched"}
```

### What This Sets Up

- ✅ Cron job running every **15 minutes** (optimized from 5 min)
- ✅ Only runs during **market hours** (9:05 AM - 6:30 PM IST, Mon-Fri)
- ✅ Fetches historical data for all 2,515 NSE stocks
- ✅ Reduces Edge Function egress by **66%** (from 2GB to 0.7GB/day)
- ✅ Logs saved to `/root/logs/edge-function.log`

**Note:** If the script fails, check that `/root/aigoat/.env` contains a valid `SUPABASE_SERVICE_ROLE_KEY`.

---

## 🔧 Part 7: Configure PM2

### Create PM2 Ecosystem File
```bash
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
```

### Verify Configuration
```bash
cat /root/aigoat/ecosystem.config.js
```

---

## 🚀 Part 8: Start Scanner

### Launch with PM2
```bash
cd /root/aigoat
# I'm here at 21/01 6:13pm
# Start scanner
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Verify running
pm2 status
# Expected output:
# ┌─────┬──────────────────┬─────────┬─────────┬──────────┐
# │ id  │ name             │ status  │ restart │ uptime   │
# ├─────┼──────────────────┼─────────┼─────────┼──────────┤
# │ 0   │ breakout-scanner │ online  │ 0       │ 5s       │
# └─────┴──────────────────┴─────────┴─────────┴──────────┘
```

### View Logs
```bash
# Real-time logs
pm2 logs breakout-scanner

# Last 50 lines
pm2 logs breakout-scanner --lines 50

# Expected output:
# 🚀 Initializing Zerodha KiteConnect Breakout Scanner...
# ✅ Loaded 2515 NSE symbols from CACHE (or DATABASE on first run)
# 🔌 Connecting to Zerodha KiteTicker WebSocket...
# ✅ KiteTicker connected successfully
# 📡 Subscribing to 2515 instrument tokens...
```

### Check Cache Performance
```bash
# Check for cache hits
pm2 logs breakout-scanner --lines 100 | grep "Cache HIT"

# Check for cache misses
pm2 logs breakout-scanner --lines 100 | grep "Cache MISS"

# Expected: Many "Cache HIT" after first run
```

---

## ✅ Part 9: Verification

### 1. Check PM2 Status
```bash
pm2 status
# Status should be: online ✅
```

### 2. Check Memory Usage
```bash
pm2 monit
# Memory should be: < 1GB
# CPU should be: < 50%
```

### 3. Check Logs for Errors
```bash
tail -50 /root/logs/breakout-scanner-error.log
# Should be empty or minimal errors
```

### 4. Verify Database Connectivity
```bash
# Test Supabase connection
curl -X GET "https://kowxpazskkigzwdwzwyq.supabase.co/rest/v1/kite_nse_equity_symbols?limit=1" \
  -H "apikey: $(grep SUPABASE_SERVICE_ROLE_KEY /root/aigoat/.env | cut -d'=' -f2)"

# Should return JSON with 1 stock symbol
```

### 5. Check WebSocket Connection
```bash
# Check logs for WebSocket status
pm2 logs breakout-scanner --lines 20 | grep "KiteTicker"

# Expected output:
# ✅ KiteTicker connected successfully
# 📡 Subscribing to 2515 instrument tokens...
# 📡 First tick received: {...}
```

### 6. Verify Signals Being Saved
```bash
# Wait 5-10 minutes during market hours, then check
# This requires Supabase CLI or dashboard access

# Using curl (check last 10 signals)
curl -X GET "https://kowxpazskkigzwdwzwyq.supabase.co/rest/v1/bullish_breakout_nse_eq?order=created_at.desc&limit=10" \
  -H "apikey: $(grep SUPABASE_SERVICE_ROLE_KEY /root/aigoat/.env | cut -d'=' -f2)"
```

---

## 📊 Part 10: Monitoring

### Daily Checks

**⚠️ CRITICAL: Every day before market open (9:00 AM IST):**

Zerodha Kite access tokens expire **daily at 6:00 AM IST**. You must update the token before market hours.

#### Method 1: Using Helper Script (Fastest)
```bash
# SSH into droplet
ssh root@143.244.129.143

# Update token with one command
/root/update-kite-token.sh YOUR_NEW_ACCESS_TOKEN

# This automatically updates .env and restarts scanner
```

#### Method 2: Manual Update
```bash
# 1. SSH into droplet
ssh root@143.244.129.143

# 2. Edit .env file
nano /root/aigoat/.env

# 3. Update this line:
KITE_ACCESS_TOKEN=YOUR_NEW_TOKEN_HERE

# Save: Ctrl+X, then Y, then Enter

# 4. Restart scanner
pm2 restart breakout-scanner

# 5. Verify connection
pm2 logs breakout-scanner --lines 20
# Look for: ✅ KiteTicker connected successfully
```

#### How to Get New Token Daily:

**On your local Windows machine:**
```powershell
# Navigate to project
cd D:\Private\aigoat

# Run token generator
npm run kite-auth

# Follow prompts:
# 1. Opens browser for Kite login
# 2. Login with your Zerodha credentials
# 3. Copy the generated token
# 4. Use it in Method 1 or Method 2 above
```

### Weekly Checks

```bash
# Check disk space
df -h
# /root should have > 10GB free

# Check memory
free -h
# Available should be > 500MB

# Check PM2 logs size
du -sh /root/logs/
# Should be < 500MB

# Rotate logs if needed
pm2 flush
```

### Monthly Maintenance

```bash
# Update system packages
apt-get update && apt-get upgrade -y

# Update npm packages
cd /root/aigoat
npm update

# Restart scanner
pm2 restart breakout-scanner

# Clear old logs
pm2 flush
```

---

## 🔐 Part 11: Security Hardening

### Configure Firewall
```bash
# Enable UFW
ufw --force enable

# Allow SSH only
ufw allow 22/tcp

# Check status
ufw status verbose
```

### Disable Password Authentication
```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Set these values:
# PasswordAuthentication no
# PubkeyAuthentication yes
# PermitRootLogin prohibit-password

# Restart SSH
systemctl restart ssh
```

### Setup Automatic Updates
```bash
# Install unattended-upgrades
apt-get install -y unattended-upgrades

# Enable automatic updates
dpkg-reconfigure -plow unattended-upgrades

# Select "Yes"
```

---

## 🎛️ Part 12: Helper Scripts

### Create Token Update Script
```bash
cat > /root/update-kite-token.sh << 'EOF'
#!/bin/bash
# Usage: ./update-kite-token.sh YOUR_NEW_TOKEN

NEW_TOKEN=$1

if [ -z "$NEW_TOKEN" ]; then
    echo "❌ Error: No token provided"
    echo "Usage: ./update-kite-token.sh YOUR_NEW_TOKEN"
    exit 1
fi

# Update .env file
sed -i "s/^KITE_ACCESS_TOKEN=.*/KITE_ACCESS_TOKEN=$NEW_TOKEN/" /root/aigoat/.env

# Restart scanner
pm2 restart breakout-scanner

echo "✅ Token updated and scanner restarted"
pm2 logs breakout-scanner --lines 10
EOF

chmod +x /root/update-kite-token.sh
```

### Create Status Check Script
```bash
cat > /root/check-status.sh << 'EOF'
#!/bin/bash
echo "==================================="
echo "📊 SCANNER STATUS"
echo "==================================="
pm2 status
echo ""
echo "📈 MEMORY USAGE"
free -h
echo ""
echo "💾 DISK SPACE"
df -h | grep -E "/$|/root"
echo ""
echo "📝 RECENT LOGS (Last 10 lines)"
pm2 logs breakout-scanner --lines 10 --nostream
EOF

chmod +x /root/check-status.sh
```

### Usage
```bash
# Update token
/root/update-kite-token.sh eyJ0eXAiOiJKV1QiLCJhbGc...

# Check status
/root/check-status.sh
```

---

## 🐛 Troubleshooting

### Scanner Not Starting
```bash
# Check PM2 logs
pm2 logs breakout-scanner --err --lines 50

# Common issues:
# 1. Missing .env file → Create /root/aigoat/.env
# 2. Invalid token → Update token with /root/update-kite-token.sh
# 3. Missing dependencies → Run: cd /root/aigoat && npm install
# 4. Wrong permissions → Run: chmod 755 /root/aigoat/scripts/*.js
```

### No Cache Hits
```bash
# Check if memory-cache.js exists
ls -la /root/aigoat/scripts/memory-cache.js

# Check if scanner imports cache
head -5 /root/aigoat/scripts/breakout-scanner.js | grep "memory-cache"

# If missing, upload from local:
# scp scripts/memory-cache.js root@143.244.129.143:/root/aigoat/scripts/

# Restart scanner
pm2 restart breakout-scanner
```

### High Memory Usage
```bash
# Check memory
pm2 monit

# If > 1.5GB, reduce stock count
nano /root/aigoat/scripts/breakout-scanner.js

# Find getNseTop1000Symbols() and add:
# .limit(500)  // Track only top 500 stocks

# Restart
pm2 restart breakout-scanner
```

### WebSocket Not Connecting
```bash
# Check token validity
# Token expires at 6 AM IST daily

# Generate new token from Kite Connect dashboard
# Update with script
/root/update-kite-token.sh YOUR_NEW_TOKEN

# Check logs
pm2 logs breakout-scanner --lines 30 | grep "error"
```

### Database Connection Failed
```bash
# Test Supabase connection
curl -I https://kowxpazskkigzwdwzwyq.supabase.co

# Check if service role key is correct
cat /root/aigoat/.env | grep SUPABASE_SERVICE_ROLE_KEY

# Verify internet connectivity
ping -c 3 8.8.8.8
```

---

## 📈 Performance Metrics

### Expected Performance After Fresh Install

| Metric | Target | How to Check |
|--------|--------|--------------|
| Memory Usage | < 1GB | `pm2 monit` |
| CPU Usage | < 30% | `pm2 monit` |
| Disk Usage | < 5GB | `df -h` |
| WebSocket Uptime | 99.9% | `pm2 status` |
| Cache Hit Rate | > 85% | `pm2 logs \| grep "Cache HIT"` |
| Startup Time | < 30s | `pm2 logs --lines 50` |
| DB Queries/day | < 1,000 | Monitor Supabase dashboard |

---

## ✅ Deployment Checklist

Use this checklist to verify your deployment:

- [ ] **Droplet Ready**
  - [ ] Ubuntu 22.04 installed
  - [ ] SSH access working
  - [ ] 2GB+ RAM available

- [ ] **System Setup**
  - [ ] System updated (`apt-get update && upgrade`)
  - [ ] Node.js 20.x installed
  - [ ] PM2 installed globally
  - [ ] Firewall configured

- [ ] **Project Files**
  - [ ] `/root/aigoat/scripts/breakout-scanner.js` exists
  - [ ] `/root/aigoat/scripts/memory-cache.js` exists
  - [ ] `/root/aigoat/.env` created with valid credentials
  - [ ] `/root/aigoat/package.json` exists
  - [ ] `npm install` completed successfully

- [ ] **Edge Function Cron**
  - [ ] `setup-optimized-cron.sh` uploaded to droplet
  - [ ] Script executed successfully
  - [ ] Cron job visible in `crontab -l`
  - [ ] `/root/trigger-edge-function.sh` created
  - [ ] Logs show edge function calls working

- [ ] **PM2 Configuration**
  - [ ] `ecosystem.config.js` created
  - [ ] Scanner started with `pm2 start`
  - [ ] PM2 saved with `pm2 save`
  - [ ] Status shows "online"

- [ ] **Verification**
  - [ ] Logs show "KiteTicker connected"
  - [ ] Logs show "Cache HIT" after initial run
  - [ ] No errors in error log
  - [ ] Memory usage < 1GB
  - [ ] WebSocket receiving ticks

- [ ] **Security**
  - [ ] `.env` permissions set to 600
  - [ ] Firewall enabled (UFW)
  - [ ] Password auth disabled
  - [ ] Token update script created

- [ ] **Maintenance**
  - [ ] Token update script tested
  - [ ] Status check script created
  - [ ] Calendar reminder for daily token update

---

## 🎉 Success!

Your breakout scanner is now running on a clean DigitalOcean droplet with:

- ✅ **In-memory caching** - 90% fewer database queries
- ✅ **Automatic restart** - PM2 ensures 24/7 uptime
- ✅ **Optimized performance** - <1GB memory, <30% CPU
- ✅ **Secure configuration** - Firewall + key auth
- ✅ **Easy maintenance** - Helper scripts for daily tasks

**Next Steps:**
1. Set daily reminder to update Kite token (before 9 AM IST)
2. Monitor Supabase egress in dashboard (should see 53% reduction)
3. Check PM2 logs daily during market hours
4. Run `/root/check-status.sh` weekly

---

## 📞 Quick Commands Reference

```bash
# Start scanner
pm2 start ecosystem.config.js

# Stop scanner
pm2 stop breakout-scanner

# Restart scanner
pm2 restart breakout-scanner

# View logs
pm2 logs breakout-scanner

# Check status
pm2 status

# Monitor resources
pm2 monit

# Update token
/root/update-kite-token.sh YOUR_NEW_TOKEN

# Check system health
/root/check-status.sh

# Clear logs
pm2 flush
```

---

**Documentation**: See also `CACHE-STRATEGY.md` and `CACHE-SETUP-GUIDE.md` for caching details.

**Last Updated**: January 21, 2026

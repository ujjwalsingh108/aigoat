# 🚀 Quick Deployment Commands

**TL;DR**: Copy-paste these commands for a fresh droplet setup

---

## 📍 Your Droplet Details
```
IP: 143.244.129.143
User: root
SSH Key: C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean
```

---

## 🧹 Part 1: Clean Droplet (5 minutes)

```bash
# SSH into droplet
ssh -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" root@143.244.129.143

# Remove cron jobs
crontab -r

# Stop and remove PM2
pm2 stop all
pm2 delete all
pm2 unstartup

# Clean directories
rm -rf /root/aigoat
rm -rf /root/logs
rm -rf /tmp/aigoat

# Verify clean
ls -la /root/
crontab -l  # Should show: no crontab
pm2 status  # Should show: [PM2] Spawning PM2 daemon with pm2_home=/root/.pm2
```

---

## ⚡ Part 2: Fresh Install (10 minutes)

```bash
# 1. Update system
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git vim nano build-essential

# 2. Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version  # Verify: v20.x.x

# 3. Install PM2
npm install -g pm2
pm2 startup  # Run the command it shows
pm2 --version  # Verify

# 4. Create directories
mkdir -p /root/aigoat/scripts
mkdir -p /root/logs
cd /root/aigoat
```

---

## 📤 Part 3: Upload Files (2 minutes)

**On your Windows machine (PowerShell):**

```powershell
cd D:\Private\aigoat

# Upload scanner
scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/breakout-scanner.js root@143.244.129.143:/root/aigoat/scripts/

# Upload cache module
scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/memory-cache.js root@143.244.129.143:/root/aigoat/scripts/

# Upload package.json
scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" package.json root@143.244.129.143:/root/aigoat/
```

**Verify on droplet:**
```bash
ls -la /root/aigoat/scripts/
# Should show: breakout-scanner.js, memory-cache.js
```

---

## ⚙️ Part 4: Configure (3 minutes)

```bash
cd /root/aigoat

# Create .env file (PASTE YOUR ACTUAL CREDENTIALS)
cat > .env << 'EOF'
SUPABASE_URL=https://kowxpazskkigzwdwzwyq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_KEY_HERE
KITE_API_KEY=k6waw89w61osj3t0
KITE_API_SECRET=YOUR_SECRET_HERE
KITE_ACCESS_TOKEN=YOUR_TOKEN_HERE
EOF

# Secure it
chmod 600 .env

# Create PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: "breakout-scanner",
    script: "./scripts/breakout-scanner.js",
    cwd: "/root/aigoat",
    instances: 1,
    autorestart: true,
    max_memory_restart: "1G",
    error_file: "/root/logs/breakout-scanner-error.log",
    out_file: "/root/logs/breakout-scanner-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  }],
};
EOF

# Install dependencies
npm install

# Verify
ls -la node_modules/  # Should show kiteconnect, @supabase, dotenv
```

---

## 🚀 Part 5: Launch (1 minute)

```bash
cd /root/aigoat

# Start scanner
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Check status
pm2 status
# Status should be: online ✅

# View logs (Ctrl+C to exit)
pm2 logs breakout-scanner
```

---

## ⏰ Part 6: Setup Edge Function Cron (2 minutes)

**IMPORTANT: Scanner needs fresh market data!**

```bash
# Upload cron setup script from Windows
cd D:\Private\aigoat
scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/setup-optimized-cron.sh root@143.244.129.143:/tmp/

# On droplet:
ssh -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" root@143.244.129.143

# Run setup
chmod +x /tmp/setup-optimized-cron.sh
/tmp/setup-optimized-cron.sh

# Verify cron installed
crontab -l
# Should show: */15 * * * * /root/trigger-edge-function.sh

# Test it (during market hours)
/root/trigger-edge-function.sh
tail -20 /root/logs/edge-function.log
```

**Configuration:**
- Runs every **15 minutes** (not 5 - saves 66% egress)
- Only during market hours (9:05 AM - 6:30 PM IST, Mon-Fri)
- Fetches historical data for scanner to analyze

**Expected logs:**
```
🚀 Initializing Zerodha KiteConnect Breakout Scanner...
✅ Loaded 2515 NSE symbols from DATABASE (cached)
🔌 Connecting to Zerodha KiteTicker WebSocket...
✅ KiteTicker connected successfully
📡 Subscribing to 2515 instrument tokens...
```

---

## ✅ Verification (2 minutes)

```bash
# 1. Check PM2 status
pm2 status
# Should show: online

# 2. Check cache is working
pm2 logs breakout-scanner --lines 50 | grep "Cache"
# Should show: ✅ Cache HIT after initial load

# 3. Check memory
pm2 monit
# Should be: < 1GB

# 4. Check for errors
tail -20 /root/logs/breakout-scanner-error.log
# Should be: empty or minimal

# 5. Test database connection
curl -I https://kowxpazskkigzwdwzwyq.supabase.co
# Should return: HTTP/2 200

# 6. Verify cron job
crontab -l
# Should show: */15 * * * * /root/trigger-edge-function.sh

# 7. Check cron logs (wait 15 min during market hours)
tail -20 /root/logs/edge-function.log
# Should show recent timestamps
```

---

## 🛠️ Helper Scripts

```bash
# Create token update script
cat > /root/update-kite-token.sh << 'EOF'
#!/bin/bash
NEW_TOKEN=$1
if [ -z "$NEW_TOKEN" ]; then
    echo "Usage: ./update-kite-token.sh YOUR_NEW_TOKEN"
    exit 1
fi
sed -i "s/^KITE_ACCESS_TOKEN=.*/KITE_ACCESS_TOKEN=$NEW_TOKEN/" /root/aigoat/.env
pm2 restart breakout-scanner
echo "✅ Token updated"
pm2 logs breakout-scanner --lines 10
EOF
chmod +x /root/update-kite-token.sh

# Create status check script
cat > /root/check-status.sh << 'EOF'
#!/bin/bash
echo "=== SCANNER STATUS ==="
pm2 status
echo ""
echo "=== MEMORY ==="
free -h
echo ""
echo "=== DISK ==="
df -h | grep -E "/$"
echo ""
echo "=== RECENT LOGS ==="
pm2 logs breakout-scanner --lines 10 --nostream
EOF
chmod +x /root/check-status.sh
```

---

## 📅 Daily Maintenance

**Every day before market open (9:00 AM IST):**

```bash
# SSH into droplet
ssh -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" root@143.244.129.143

# Update token (get from Kite Connect dashboard)
/root/update-kite-token.sh YOUR_NEW_DAILY_TOKEN

# Verify logs
pm2 logs breakout-scanner --lines 20
# Look for: ✅ KiteTicker connected successfully
```

---

## 🚨 Quick Troubleshooting

### Scanner offline?
```bash
pm2 restart breakout-scanner
pm2 logs breakout-scanner --err --lines 30
```

### Token expired?
```bash
/root/update-kite-token.sh YOUR_NEW_TOKEN
```

### High memory?
```bash
pm2 restart breakout-scanner
pm2 monit  # Check if < 1GB
```

### No cache hits?
```bash
# Verify memory-cache.js exists
ls -la /root/aigoat/scripts/memory-cache.js

# If missing, upload from local
# Then restart
pm2 restart breakout-scanner
```

---

## 📊 Useful Commands

```bash
# View all logs
pm2 logs breakout-scanner

# Last 50 lines
pm2 logs breakout-scanner --lines 50

# Only errors
pm2 logs breakout-scanner --err

# Clear logs
pm2 flush

# Stop scanner
pm2 stop breakout-scanner

# Start scanner
pm2 start ecosystem.config.js

# Restart scanner
pm2 restart breakout-scanner

# Check status
pm2 status

# Monitor resources
pm2 monit

# System status
/root/check-status.sh
```

---

## 🎯 Expected Results

After successful deployment:

- ✅ PM2 status: **online**
- ✅ Memory usage: **< 1GB**
- ✅ CPU usage: **< 30%**
- ✅ Cache hit rate: **> 85%** (after first run)
- ✅ WebSocket: **connected**
- ✅ Logs: **no errors**
- ✅ Database: **receiving signals** (during market hours)
- ✅ Cron job: **installed** (runs every 15 min)
- ✅ Edge function: **fetching data** (check logs)
- ✅ Total egress: **< 1GB/day** (monitor Supabase dashboard)

---

## 📞 Emergency Commands

```bash
# Stop everything
pm2 stop all

# Start everything
pm2 restart all

# Delete all PM2 processes
pm2 delete all

# Reinstall scanner from scratch
cd /root
rm -rf aigoat
# Then follow deployment steps again
```

---

## 📚 Full Guides

- **Detailed Guide**: `docs/FRESH-DROPLET-DEPLOYMENT.md`
- **Cache Strategy**: `docs/CACHE-STRATEGY.md`
- **Cache Setup**: `docs/CACHE-SETUP-GUIDE.md`

---

**Total Setup Time**: ~20 minutes  
**Daily Maintenance**: ~2 minutes (token update)

**Last Updated**: January 21, 2026

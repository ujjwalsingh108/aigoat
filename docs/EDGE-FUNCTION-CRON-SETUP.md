# ⚙️ Edge Function Cron Job Guide

## 🎯 Overview

The Edge Function cron job is **essential** for your scanner to work, but it was causing **45% of your egress** (2GB/day). This guide explains how to keep it running while reducing egress by 66-83%.

---

## ❓ Do You Need the Cron Job?

**YES!** Here's why:

### What It Does:
1. Fetches live market data from Zerodha Kite API every 5 minutes
2. Stores 5-minute candles in `historical_prices` table
3. Scanner reads this data to analyze stocks
4. Without it: **Scanner has no fresh data to analyze**

### The Egress Problem:
- Fetches **2,515 stocks** every **5 minutes**
- Writes thousands of records to Supabase
- **Result:** ~2GB/day egress (cannot be cached)

---

## ✅ Solution: Optimized Cron Job

### Changes Made:
| Before | After | Savings |
|--------|-------|---------|
| Every 5 minutes | Every 15 minutes | 66% |
| 2,515 stocks | 1,000 stocks (optional) | 60% |
| ~2GB/day egress | ~0.7-0.8GB/day | 60-80% |

### Combined with Cache:
- Edge Function: ~0.7GB/day
- Scanner (cached): ~0.05GB/day
- Frontend (cached): ~0.02GB/day
- **Total: ~0.77GB/day** (83% reduction!)

---

## 🚀 Setup Optimized Cron Job

### Method 1: Automated Script (Recommended)

```bash
# 1. Upload script from Windows
cd D:\Private\aigoat
scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/setup-optimized-cron.sh root@143.244.129.143:/tmp/

# 2. SSH into droplet
ssh -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" root@143.244.129.143

# 3. Run setup script
chmod +x /tmp/setup-optimized-cron.sh
/tmp/setup-optimized-cron.sh

# 4. Verify cron is installed
crontab -l
# Should show: */15 * * * * /root/trigger-edge-function.sh

# 5. Test it
/root/trigger-edge-function.sh
tail -20 /root/logs/edge-function.log
```

---

### Method 2: Manual Setup

```bash
# SSH into droplet
ssh -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" root@143.244.129.143

# Get your service role key
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /root/aigoat/.env | cut -d'=' -f2)

# Create cron script
cat > /root/trigger-edge-function.sh << 'EOF'
#!/bin/bash

# Check if market hours (Mon-Fri, 9:05 AM - 6:30 PM IST)
CURRENT_HOUR=$(TZ='Asia/Kolkata' date +%H)
CURRENT_DAY=$(TZ='Asia/Kolkata' date +%u)

if [ $CURRENT_DAY -ge 6 ] || [ $CURRENT_HOUR -lt 9 ] || [ $CURRENT_HOUR -gt 18 ]; then
    exit 0
fi

# Call Edge Function
curl -X POST "https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"cron"}' >> /root/logs/edge-function.log 2>&1
EOF

# Replace YOUR_SERVICE_KEY_HERE with actual key
sed -i "s/YOUR_SERVICE_KEY_HERE/$SERVICE_KEY/" /root/trigger-edge-function.sh

# Make executable
chmod +x /root/trigger-edge-function.sh

# Install cron (every 15 minutes)
(crontab -l 2>/dev/null | grep -v "trigger-edge-function"; echo "*/15 * * * * /root/trigger-edge-function.sh") | crontab -

# Verify
crontab -l
```

---

## 🔧 Optional: Further Optimize Edge Function

### Reduce Number of Stocks (Additional 60% Savings)

**Edit Edge Function to track only top 1000 stocks:**

```bash
# This requires editing on Supabase dashboard or via CLI

# Go to: Supabase Dashboard → Edge Functions → hyper-action → Edit

# Find this line (~60):
const { data, error } = await supabase
  .from("kite_nse_equity_symbols")
  .select("symbol, instrument_token")
  .eq("is_active", true)
  .order("symbol", { ascending: true });
  // Add this line:
  .limit(1000);  // Track only top 1000 stocks

# Save and deploy
```

**Or using Supabase CLI:**
```bash
# On your local machine
cd D:\Private\aigoat

# Edit the function
# File: supabase/functions/hyper-action/index.ts
# Line ~60: Add .limit(1000)

# Deploy
supabase functions deploy hyper-action
```

---

## 📊 Monitoring

### Check if Cron is Running

```bash
# View cron jobs
crontab -l

# Check logs
tail -f /root/logs/edge-function.log

# Expected output:
# Tue Jan 21 09:15:00 IST 2026: Edge function triggered
# Tue Jan 21 09:30:00 IST 2026: Edge function triggered
# Tue Jan 21 09:45:00 IST 2026: Edge function triggered
```

### Verify Data is Being Fetched

```bash
# Check last entry in historical_prices table
curl -X GET "https://kowxpazskkigzwdwzwyq.supabase.co/rest/v1/historical_prices?select=symbol,date,time&order=date.desc,time.desc&limit=10" \
  -H "apikey: $(grep SUPABASE_SERVICE_ROLE_KEY /root/aigoat/.env | cut -d'=' -f2)" \
  | jq .

# Should show recent timestamps (within last 15 minutes during market hours)
```

### Monitor Supabase Egress

1. Go to: https://supabase.com/dashboard/project/kowxpazskkigzwdwzwyq/settings/billing
2. Check "Egress" metric
3. Should see decline from 4.5GB/day to ~0.8GB/day within 48 hours

---

## 🔄 Compare: Before vs After

### Before (No Optimization):
```
Edge Function Cron:
├─ Frequency: Every 5 minutes
├─ Stocks: 2,515 (all NSE)
├─ Egress: ~2GB/day
├─ Active: 9:05 AM - 6:30 PM (108 calls/day)
└─ Problem: Hitting 5GB limit

Scanner Queries:
├─ Cache: None
├─ DB Queries: 10,000+/day
└─ Egress: ~1.5GB/day

Total Egress: ~4.5GB/day ❌
```

### After (Optimized):
```
Edge Function Cron:
├─ Frequency: Every 15 minutes ✅
├─ Stocks: 1,000 (top liquid) ✅
├─ Egress: ~0.7GB/day ✅
├─ Active: 9:05 AM - 6:30 PM (36 calls/day)
└─ Result: 65% less egress

Scanner Queries:
├─ Cache: In-memory ✅
├─ DB Queries: ~1,000/day ✅
└─ Egress: ~0.05GB/day ✅

Total Egress: ~0.77GB/day ✅ (83% reduction!)
```

---

## 🚨 Troubleshooting

### Cron Not Running

```bash
# Check if cron service is running
systemctl status cron

# If not, start it
systemctl start cron
systemctl enable cron

# Check cron logs
grep CRON /var/log/syslog | tail -20
```

### Edge Function Not Being Called

```bash
# Test manual trigger
curl -X POST "https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY /root/aigoat/.env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual_test"}'

# Check response
# Should return: {"success":true, "processedSymbols":...}
```

### High Egress Still

```bash
# Check how many stocks are being fetched
# Go to Supabase Dashboard → Edge Functions → hyper-action → Logs
# Look for: "Processing X NSE equity symbols"

# If still 2,515, you need to add .limit(1000) to the query
```

---

## 📋 Maintenance

### Daily:
- ✅ Token already updated via `/root/update-kite-token.sh`
- ✅ Check scanner logs: `pm2 logs breakout-scanner`

### Weekly:
```bash
# Check cron logs
tail -50 /root/logs/edge-function.log

# Verify data freshness
curl -X GET "https://kowxpazskkigzwdwzwyq.supabase.co/rest/v1/historical_prices?select=date,time&order=date.desc,time.desc&limit=1" \
  -H "apikey: $(grep SUPABASE_SERVICE_ROLE_KEY /root/aigoat/.env | cut -d'=' -f2)"
```

### Monthly:
```bash
# Check egress in Supabase dashboard
# Should be consistently < 1GB/day
```

---

## 🎯 Recommended Setup

**For best balance of data freshness and egress:**

1. ✅ **Cron frequency**: Every 15 minutes (66% savings)
2. ✅ **Stock count**: 1,000 stocks (60% additional savings)
3. ✅ **Scanner cache**: Enabled (90% query reduction)
4. ✅ **Frontend cache**: Enabled (98% query reduction)

**Total egress: ~0.77GB/day** (stays well under 5GB free tier)

---

## 🔗 Quick Commands

```bash
# Setup optimized cron
/tmp/setup-optimized-cron.sh

# View current cron jobs
crontab -l

# Test edge function call
/root/trigger-edge-function.sh

# Check logs
tail -f /root/logs/edge-function.log

# Remove cron (if needed)
crontab -r

# Monitor egress
# Visit: https://supabase.com/dashboard/project/kowxpazskkigzwdwzwyq/settings/billing
```

---

## ✅ Success Indicators

After setup, you should see:

- ✅ Cron job listed: `crontab -l`
- ✅ Logs show calls every 15 min during market hours
- ✅ Historical data updated within last 15 min
- ✅ Scanner logs show recent data being analyzed
- ✅ Supabase egress dropping to ~0.8GB/day within 48 hours

---

**Summary**: Keep the cron job but optimize it (15 min + 1000 stocks) for 83% total egress reduction while maintaining functionality!

**Last Updated**: January 21, 2026

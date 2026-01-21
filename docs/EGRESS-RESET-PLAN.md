# 🔄 Egress Reset & Cache Activation Plan

## Current Status (Jan 21, 2026)
- **Egress:** 7.341GB / 5GB (147%) ❌
- **Next Reset:** Jan 25, 2026 (4 days)
- **Cache Status:** ✅ Implemented but not active
- **Cron Job:** ✅ Running every 15 minutes

---

## 🚨 PHASE 1: IMMEDIATE - Stop All Egress (NOW)

### 1.1 Stop Cron Job on Droplet
```bash
# SSH into droplet
ssh -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" root@143.244.129.143

# Disable cron job temporarily
crontab -l > /root/cron-backup.txt
crontab -r

# Verify it's stopped
crontab -l
# Should show: no crontab for root
```

### 1.2 Stop PM2 Scanner Process
```bash
# On droplet
pm2 stop breakout-scanner
pm2 list

# Expected output: breakout-scanner status = stopped
```

### 1.3 Disable Frontend Polling (Optional)
If your frontend is still polling:
- Comment out auto-refresh in screener pages
- Or set polling interval to 5 minutes instead of 15 seconds

---

## ⏳ PHASE 2: WAIT - Let Billing Cycle Reset (Jan 22-24)

### What Happens:
- Egress counter resets to 0GB on **Jan 25, 2026**
- No new charges if you stay stopped
- System remains offline but safe

### Monitor:
Check Supabase dashboard daily:
```
https://supabase.com/dashboard/project/kowxpazskkigzwdwzwyq/settings/billing
```

---

## 🚀 PHASE 3: RESTART - Activate Cache System (Jan 25+)

### 3.1 Verify Cache Files Are Deployed

**On Droplet:**
```bash
ssh root@143.244.129.143
cd /root/aigoat/scripts
ls -lh

# Should see:
# - breakout-scanner.js (modified with cache)
# - memory-cache.js (new)
```

**If missing:**
```bash
# From local machine
scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/memory-cache.js root@143.244.129.143:/root/aigoat/scripts/
scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/breakout-scanner.js root@143.244.129.143:/root/aigoat/scripts/
```

### 3.2 Setup Redis (Upstash)

1. Sign up at https://upstash.com/ (FREE tier)
2. Create database: `aigoat-cache`
3. Region: Mumbai/Singapore (closest to DigitalOcean Bangalore)
4. Copy credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3.3 Add Redis Credentials

**On Droplet (.env):**
```bash
ssh root@143.244.129.143
nano /root/aigoat/.env

# Add these lines:
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ

# Save: Ctrl+O, Enter, Ctrl+X
```

**In Local/Vercel (.env.local):**
```bash
# Add same credentials locally
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ
```

### 3.4 Test Cache Locally (Optional)
```bash
# On local machine
npm run dev

# Visit: http://localhost:3000/api/signals/bullish
# Should see: { "cached": true, ... }
```

### 3.5 Restart Droplet Services

```bash
ssh root@143.244.129.143

# 1. Restart PM2 scanner with cache
pm2 restart breakout-scanner
pm2 logs breakout-scanner

# Look for logs like:
# ✅ Loaded 2515 NSE symbols from CACHE
# ✅ Cache HIT: historical:RELIANCE:2026-01-25:25

# 2. Re-enable cron job
crontab /root/cron-backup.txt
crontab -l

# Should show:
# */15 * * * * /root/trigger-edge-function.sh
```

### 3.6 Monitor First 24 Hours

**Check Cache Performance:**
```bash
# On droplet
pm2 logs breakout-scanner | grep "Cache HIT"

# High count = good (80%+ cache hits expected)
```

**Check Supabase Egress:**
```
Dashboard → Settings → Billing → Usage → Egress
After 24 hours: Should be ~0.7GB (vs previous 4.5GB)
```

---

## 📊 Expected Results (After Cache)

### Before Cache:
```
Edge Function:  2.0 GB/day (45%)
Scanner:        1.5 GB/day (33%)  ← Cache will fix this
Frontend:       1.0 GB/day (22%)  ← Cache will fix this
────────────────────────────────
TOTAL:          4.5 GB/day (90% of limit) ❌
```

### After Cache:
```
Edge Function:  2.0 GB/day (95%)  ← Unchanged (data source)
Scanner:        0.05 GB/day (2%)  ← 97% reduction ✅
Frontend:       0.02 GB/day (1%)  ← 98% reduction ✅
────────────────────────────────
TOTAL:          2.1 GB/day (42% of limit) ✅ SAFE!
```

**Savings:** 2.4GB/day (53% reduction)

---

## 🔍 Verification Checklist

After restart, verify all systems:

### ✅ Cache Working:
- [ ] Droplet logs show "Cache HIT" messages
- [ ] Redis dashboard shows commands being used
- [ ] Frontend API returns `"cached": true`

### ✅ Data Fresh:
- [ ] Screener shows recent signals (within 15 min)
- [ ] Timestamps are current
- [ ] No stale data warnings

### ✅ Egress Reduced:
- [ ] After 24h: Egress < 2.5GB
- [ ] After 48h: Egress < 5GB
- [ ] After 7 days: Egress < 15GB (on track)

---

## 🆘 Troubleshooting

### Cache Not Working:
```bash
# Check Redis connection
ssh root@143.244.129.143
cd /root/aigoat
node -e "console.log(require('dotenv').config()); console.log(process.env.UPSTASH_REDIS_REST_URL)"

# Should print your Upstash URL
```

### Egress Still High:
1. Check cron frequency (should be */15, not */5)
2. Verify cache TTL settings
3. Consider reducing to 500 stocks (optional)

### PM2 Scanner Crashes:
```bash
pm2 logs breakout-scanner --err
# Check for errors, might need to install deps
```

---

## 📅 Timeline Summary

| Date | Action | Status |
|------|--------|--------|
| Jan 21 | Stop all services | ⏸️ DO NOW |
| Jan 22-24 | Wait for billing reset | ⏳ WAIT |
| Jan 25 | Setup Redis + Restart | 🚀 EXECUTE |
| Jan 26 | Monitor first 24h | 📊 VERIFY |
| Jan 27+ | Normal operations | ✅ SAFE |

---

## 🎯 Success Criteria

After full implementation:
- ✅ Egress stays under 5GB/month (free tier)
- ✅ Cache hit rate > 85%
- ✅ Frontend loads in <200ms
- ✅ Scanner runs smoothly
- ✅ No Supabase restrictions

---

## 💡 Pro Tips

1. **Keep cron backup:** `/root/cron-backup.txt` for easy restore
2. **Monitor daily:** First week, check egress every morning
3. **Redis free tier:** 10K commands/day = plenty for your usage
4. **PM2 persistence:** Run `pm2 save` after any changes

---

**Next Action:** Stop services NOW to prevent more overage!

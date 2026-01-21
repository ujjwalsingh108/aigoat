# 🚀 Quick Setup: Cache Implementation

## Overview
This guide helps you implement caching to reduce Supabase egress from 5GB to ~2GB/day.

---

## ⚡ Step 1: Install Dependencies

```bash
npm install @upstash/redis
```

---

## 🔑 Step 2: Get Upstash Redis Credentials

1. Go to https://upstash.com/
2. Sign up (free tier: 10K commands/day, 256MB storage)
3. Click "Create Database"
4. Name it: `aigoat-cache`
5. Region: Choose closest to your users
6. Copy the credentials shown

---

## 📝 Step 3: Add Environment Variables

Add to your `.env.local` file:

```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ
```

**IMPORTANT:** Add these same variables to:
- ✅ Vercel/Netlify environment variables (if deployed)
- ✅ Local `.env.local` file
- ✅ DigitalOcean droplet `.env` file (for scanner)

---

## 🔄 Step 4: Deploy Scanner Updates

SSH into your DigitalOcean droplet:

```bash
ssh root@your_droplet_ip

# Navigate to project
cd /root/aigoat

# Upload the new memory-cache.js file
# (Use scp from your local machine first)
scp scripts/memory-cache.js root@your_droplet_ip:/root/aigoat/scripts/

# Restart scanner with updated code
pm2 restart breakout-scanner

# Check logs to verify cache is working
pm2 logs breakout-scanner | grep "Cache"
```

You should see:
```
✅ Loaded 2515 NSE symbols from CACHE
✅ Cache HIT: nse_equity_symbols
```

---

## 🧪 Step 5: Test Locally

```bash
# Start dev server
npm run dev

# Open browser
http://localhost:3000/screener/intraday-bullish

# Check browser console (F12)
# You should see faster load times on subsequent requests
```

---

## 📊 Step 6: Monitor Results

### Check Supabase Egress
1. Go to Supabase Dashboard
2. Settings → Billing → Usage
3. Watch "Egress" metric over next 24 hours

### Expected Results:
- **Before:** 4.5GB/day ❌
- **After:** 2.1GB/day ✅ (53% reduction)

### Check Cache Performance

**Frontend (Browser Console):**
```javascript
// In browser console on /screener page
fetch('/api/signals/bullish').then(r => r.json()).then(console.log)
// Look for "cached: true" in response
```

**Scanner (Droplet):**
```bash
pm2 logs breakout-scanner --lines 100 | grep "Cache HIT"
# High count = good cache performance
```

---

## ⚙️ Optional: Advanced Optimizations

### Reduce Edge Function Frequency

If still hitting limits, reduce from every 5 min to every 15 min:

**On DigitalOcean Droplet:**
```bash
# Edit crontab
crontab -e

# Change from:
*/5 * * * * /root/fetch-historical-cron.sh

# To:
*/15 * * * * /root/fetch-historical-cron.sh
```

**Savings:** 66% reduction → saves ~700MB/day

### Track Fewer Stocks

Edit `/root/aigoat/scripts/breakout-scanner.js`:

```javascript
// Line ~65, in getNseTop1000Symbols()
.limit(500) // Add this to fetch only top 500 stocks
```

**Savings:** 80% reduction → saves ~1.2GB/day

---

## 🐛 Troubleshooting

### "Redis not configured" warning
- ✅ Check `.env.local` has both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- ✅ Restart dev server: `npm run dev`
- ✅ Check for typos in variable names

### Cache not working in scanner
```bash
# Verify file exists
ls -la /root/aigoat/scripts/memory-cache.js

# Check scanner code has cache import
head -5 /root/aigoat/scripts/breakout-scanner.js
# Should show: const cache = require("./memory-cache");

# Restart scanner
pm2 restart breakout-scanner
```

### Still high egress after 24 hours
1. Verify Redis is configured (check Step 3)
2. Implement "Optional: Advanced Optimizations" above
3. Check if Edge Function is the main culprit (see logs)

---

## 📈 Success Metrics

After 24 hours, you should see:

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Daily Egress | 4.5GB | ~2.1GB | ✅ 53% reduction |
| Frontend Load Time | ~800ms | ~150ms | ✅ 5x faster |
| Scanner DB Queries | ~10K/day | ~1K/day | ✅ 90% reduction |
| Free Tier Status | ⚠️ Near limit | ✅ Safe | ✅ Stays free |

---

## 📚 Next Steps

1. ✅ Install dependencies
2. ✅ Get Upstash credentials
3. ✅ Add environment variables
4. ✅ Deploy scanner updates
5. ✅ Test locally
6. ✅ Monitor for 24 hours
7. ⏭️ If still high: Implement advanced optimizations
8. ⏭️ Consider upgrading Supabase plan if growth continues

---

## 📞 Need Help?

- Upstash Docs: https://docs.upstash.com/redis
- Supabase Egress: https://supabase.com/docs/guides/platform/org-based-billing#pricing-breakdown
- Full documentation: See `docs/CACHE-STRATEGY.md`


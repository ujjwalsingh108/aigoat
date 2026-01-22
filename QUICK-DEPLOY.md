# 🚀 Quick Deployment Guide - Swing Positional Strategy

## ✅ Status: READY FOR DEPLOYMENT

All code changes complete. Build passing. Scanner syntax valid.

---

## 📋 Pre-Deployment Checklist

- [x] Database migration SQL created
- [x] API route implemented
- [x] UI page created
- [x] Scanner logic integrated
- [x] TypeScript compilation: PASSED
- [x] Next.js build: PASSED
- [x] JavaScript syntax check: PASSED
- [ ] **Database migration executed** ⬅️ DO THIS NOW
- [ ] Scanner deployed to droplet (Jan 25+)

---

## 🎯 Step 1: Execute Database Migration (NOW)

### Via Supabase Dashboard:
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy contents from: `supabase/migrations/create_swing_positional_bullish.sql`
6. Paste into editor
7. Click **Run** (or press F5)
8. ✅ Should see: "Success. No rows returned"

### Verify Table Created:
```sql
SELECT * FROM swing_positional_bullish LIMIT 1;
```
Should return: "0 rows" (empty table, ready for data)

---

## 🎯 Step 2: Deploy Scanner (After Jan 25)

### SSH into Droplet:
```bash
ssh -i ~/.ssh/id_ed25519_digitalocean root@143.244.129.143
cd /root/aigoat
```

### Pull Latest Code:
```bash
git pull origin main
```

### Restart Scanner:
```bash
pm2 restart breakout-scanner
pm2 logs breakout-scanner --lines 50
```

### Look For These Logs:
```
✅ Loaded historical data for 2515 symbols
📅 SWING POSITIONAL SAVED: RELIANCE - SWING_POSITIONAL_BULLISH (83% confidence) @ ₹2450.50
```

---

## 🎯 Step 3: Verify UI (Immediately)

### Local Test:
```bash
npm run dev
```

### Navigate to:
- http://localhost:3000/screener
- Click **"Swing Positional Equity Bullish (1-15 days)"** card
- Should load: `/screener/swing-positional-bullish`
- Should show: **"0 Active Signals"** (until scanner runs)

### After Scanner Runs:
- Refresh page
- Should show: **"X Active Signals"**
- Signals display in grid
- AI button works (if logged in)

---

## 🔍 What Changed

### Frontend (Ready Now ✅):
- New page: `/screener/swing-positional-bullish`
- New API: `/api/signals/swing-positional`
- Updated: ScreenerCard routing, AI types, cache keys

### Scanner (Deploys Jan 25):
- Added: 4 new technical indicator methods
- Added: `analyzeSwingPositional()` with 6 filters
- Added: `saveSwingPositionalSignal()` database method
- Updated: Loads 365 days (was 30 days)
- Updated: Runs swing analysis hourly per stock

### Database (Execute Migration NOW):
- New table: `swing_positional_bullish`
- Columns: symbol, signal_type, probability, criteria_met, daily_ema20, daily_sma50, rsi_value, volume_ratio, weekly_volatility, target_price, stop_loss, etc.
- Indexes: symbol+time, probability, created_at, market_cap

---

## 📊 Expected Results

### Signal Volume:
- **Intraday Bullish**: 10-50 signals/day (existing)
- **Intraday Bearish**: 10-50 signals/day (existing)
- **Swing Positional**: 5-20 signals/day (new, more selective)

### Criteria (6 Filters):
1. ✅ NIFTY 2500 Universe
2. ✅ Price > 20 EMA & 50 SMA (Daily)
3. ✅ RSI 50-80 (Daily)
4. ✅ Volume > 2x Yearly Average
5. ✅ Volatility 1-5% Weekly
6. ✅ Market Cap Top 2500

### Signal Frequency:
- Saves max **once per hour** per stock
- Only if **5-6 criteria met** (high confidence)

---

## 🛠️ Troubleshooting

### "No signals generated"
**Cause:** Market conditions or filters too strict  
**Check:** `pm2 logs breakout-scanner | grep "criteria_met"`  
**Solution:** Normal if market not meeting criteria

### "Table does not exist"
**Cause:** Migration not executed  
**Fix:** Run migration SQL in Supabase dashboard

### "Build errors"
**Cause:** Already fixed!  
**Status:** Build passing ✅

### "Scanner crashes"
**Cause:** Possibly memory (365 days × 2500 stocks)  
**Fix:** Monitor with `pm2 monit`, may need droplet RAM upgrade

---

## 📚 Documentation

Full details in:
- `docs/SWING-POSITIONAL-INTEGRATION.md` - Architecture & code examples
- `docs/SWING-POSITIONAL-DEPLOYMENT.md` - Complete deployment guide

---

## ⏱️ Timeline

**Now (Jan 22):**
- ✅ All code changes complete
- ✅ Build passing
- ⏳ Execute database migration

**Jan 25+ (Market Open):**
- ⏳ Deploy scanner to droplet
- ⏳ Verify signals generating
- ⏳ Monitor performance

---

## 🎉 Summary

The swing positional strategy is **fully implemented and ready**. The only remaining steps are:

1. **Execute database migration** (5 minutes)
2. **Deploy scanner** on Jan 25 (5 minutes)

No breaking changes. Existing features unaffected. Risk: Low.

**You're ready to go! 🚀**

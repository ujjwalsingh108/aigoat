# 📋 Pattern Detection - Quick Deployment Checklist

## Pre-Deployment (Run Locally First)

- [ ] Install Groq SDK: `npm install groq-sdk`
- [ ] Add `GROQ_API_KEY` to `.env.local`
- [ ] Test build: `npm run build`
- [ ] Verify no TypeScript errors
- [ ] Run database migration in Supabase SQL Editor

## Database Migration (Critical!)

- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy/paste `supabase/migrations/add_pattern_detection_columns.sql`
- [ ] Run the migration
- [ ] Verify columns added:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'bullish_breakout_nse_eq' 
  AND column_name LIKE '%pattern%';
  ```

## Droplet Deployment

- [ ] Upload pattern detector:
  ```bash
  scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/pattern-detector.js root@143.244.129.143:/root/aigoat/scripts/
  ```

- [ ] Upload updated scanner:
  ```bash
  scp -i "C:\Users\Ujjwal Singh\.ssh\id_ed25519_digitalocean" scripts/breakout-scanner.js root@143.244.129.143:/root/aigoat/scripts/
  ```

- [ ] Restart scanner:
  ```bash
  ssh root@143.244.129.143 "cd /root/aigoat && pm2 restart breakout-scanner"
  ```

- [ ] Check logs:
  ```bash
  ssh root@143.244.129.143 "pm2 logs breakout-scanner --lines 50 | grep Pattern"
  ```

## Frontend Deployment

- [ ] Add `GROQ_API_KEY` to Vercel environment variables
- [ ] Commit changes:
  ```bash
  git add .
  git commit -m "feat: integrate pattern detection + AI validation"
  git push origin main
  ```

- [ ] Verify Vercel auto-deploy or run: `vercel --prod`

## Post-Deployment Verification

### Scanner (Droplet)
- [ ] SSH in: `ssh root@143.244.129.143`
- [ ] Check logs: `pm2 logs breakout-scanner`
- [ ] Look for: `🎯 Pattern detected for SYMBOL: ...`
- [ ] Verify no errors

### Database
- [ ] Check Supabase Dashboard → Table Editor
- [ ] Open `bullish_breakout_nse_eq`
- [ ] Verify `detected_patterns`, `strongest_pattern`, `pattern_confidence` columns exist
- [ ] Check recent rows have pattern data

### Frontend
- [ ] Visit: `/screener/intraday-bullish`
- [ ] Verify pattern badges show on signal cards
- [ ] Click "AI Validate" button
- [ ] Check AI validation displays correctly
- [ ] Test on mobile responsiveness

## Testing

### Test Pattern Detection
```bash
# On droplet
pm2 logs breakout-scanner | grep -i "pattern"
```

Expected output:
```
🎯 Pattern detected for RELIANCE: { pattern: 'BULL_FLAG', direction: 'bullish', confidence: 85 }
```

### Test AI Validation
```javascript
// Browser console (logged in)
fetch('/api/validate-breakout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ symbol: 'RELIANCE', direction: 'bullish' })
}).then(r => r.json()).then(console.log)
```

Expected response:
```json
{
  "success": true,
  "validation": {
    "verdict": "TRUE_POSITIVE",
    "confidence": 0.85,
    "reasoning": "...",
    "risk_factors": [...],
    "entry_suggestion": "..."
  }
}
```

## Rollback Plan (If Issues)

### Revert Scanner
```bash
ssh root@143.244.129.143
cd /root/aigoat
git checkout HEAD~1 scripts/breakout-scanner.js
pm2 restart breakout-scanner
```

### Revert Frontend
```bash
git revert HEAD
git push origin main
```

### Database (No Action Needed)
- New columns are optional
- Existing queries work fine
- Can drop columns later if needed

## Expected Behavior

### Pattern Detection:
- Runs automatically during scanner cycles
- Adds 5-15ms per stock (negligible)
- Stores patterns in JSON format
- No impact on existing 6-criteria logic

### AI Validation:
- Triggered ONLY when user clicks button
- Takes ~500ms per validation
- Rate limited to 100/day per user
- Results cached in database

## Monitoring (First 24 Hours)

- [ ] Day 1 @ 9:30 AM: Check scanner started
- [ ] Day 1 @ 10:00 AM: Verify patterns detected
- [ ] Day 1 @ 2:00 PM: Test AI validation in production
- [ ] Day 1 @ 3:30 PM: Check before market close
- [ ] Day 2: Review pattern accuracy

## Performance Benchmarks

Expected metrics after deployment:

| Metric | Target | Acceptable |
|--------|--------|-----------|
| Pattern detection time | <10ms | <20ms |
| Total scan time | <200ms | <300ms |
| AI validation time | ~500ms | <2s |
| Memory increase | <15MB | <30MB |
| Pattern detection rate | >80% | >60% |

## Success Criteria

✅ **Core Functionality:**
- [ ] Scanner runs without errors
- [ ] Patterns appear in database
- [ ] Frontend displays patterns
- [ ] AI validation button works
- [ ] No performance degradation

✅ **User Experience:**
- [ ] Pattern badges show correctly
- [ ] Confidence scores make sense
- [ ] AI validation provides useful insights
- [ ] No UI glitches or freezes

✅ **System Stability:**
- [ ] No database errors
- [ ] No memory leaks
- [ ] No API rate limit issues
- [ ] Logs are clean

---

## 🎉 Ready to Deploy!

Once all items checked, your pattern detection system is fully integrated and ready for production use.

**Deployment Window:** Jan 25, 2026 (after egress reset)

**Estimated Integration Time:** 30-45 minutes

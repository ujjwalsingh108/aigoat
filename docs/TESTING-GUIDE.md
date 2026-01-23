# Testing Guide - Production SaaS Billing System

## 🧪 Complete Testing Checklist

---

## 1. Database Setup Testing

### Step 1: Run Migrations
```bash
# Connect to Supabase
npx supabase link --project-ref kowxpazskkigzwdwzwyq

# Run all migrations
npx supabase migration up
```

**Verify:**
- [ ] `payment_events` table created
- [ ] `subscription_history` table created
- [ ] `invoices` table created
- [ ] `webhook_events` table created
- [ ] `usage_quotas` table created
- [ ] RLS policies applied
- [ ] `increment_usage()` function created

### Step 2: Verify RLS Policies
```sql
-- Check policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN (
  'subscriptions', 'payment_events', 'subscription_history', 
  'usage_quotas', 'webhook_events', 'invoices'
);
```

**Expected:** At least 2-3 policies per table (SELECT, INSERT, UPDATE)

---

## 2. Authentication Testing

### Test User Setup
1. Create test organization in Supabase:
```sql
-- Insert test organization
INSERT INTO organizations (id, name, created_at)
VALUES ('test-org-uuid', 'Test Organization', NOW());

-- Link user to organization
INSERT INTO organization_members (organization_id, user_id, role, is_active)
VALUES ('test-org-uuid', 'YOUR_USER_ID', 'owner', true);
```

2. Get access token:
```javascript
// In browser console on localhost:3000
const { data } = await supabase.auth.getSession();
console.log(data.session.access_token);
```

---

## 3. Payment Flow Testing

### A. Create Billing Plan
```sql
INSERT INTO billing_plans (
  id, name, description, price_monthly, price_yearly,
  features, is_active, is_popular
) VALUES (
  'premium-plan-uuid',
  'Premium Plan',
  'Full access to all features',
  999.00,
  9990.00,
  '{
    "signals_per_day": 100,
    "ai_prompts_per_day": 50,
    "email_alerts": true,
    "sms_alerts": true,
    "api_access": true,
    "advanced_filters": true,
    "custom_watchlists": 10,
    "export_data": true
  }'::jsonb,
  true,
  true
);
```

### B. Test Subscription Creation
```bash
curl -X POST http://localhost:3000/api/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "plan_id": "premium-plan-uuid",
    "billing_cycle": "monthly",
    "organization_id": "test-org-uuid"
  }'
```

**Expected Response:**
```json
{
  "payment_url": "https://test.payu.in/_payment",
  "payload": {
    "key": "brCQvM",
    "txnid": "txn_...",
    "amount": "999.00",
    "productinfo": "Premium Plan - Monthly",
    "firstname": "...",
    "email": "...",
    "hash": "..."
  }
}
```

**Verify Database:**
```sql
SELECT * FROM subscriptions 
WHERE organization_id = 'test-org-uuid' 
ORDER BY created_at DESC LIMIT 1;
```

**Expected:** Status = `pending_payment`

### C. Test PayU Payment (Sandbox)
1. Copy `payment_url` and `payload` from API response
2. Create HTML test form:
```html
<!DOCTYPE html>
<html>
<body>
  <form method="POST" action="https://test.payu.in/_payment">
    <input type="hidden" name="key" value="brCQvM" />
    <input type="hidden" name="txnid" value="txn_xxx" />
    <input type="hidden" name="amount" value="999.00" />
    <input type="hidden" name="productinfo" value="Premium Plan" />
    <input type="hidden" name="firstname" value="Test User" />
    <input type="hidden" name="email" value="test@example.com" />
    <input type="hidden" name="phone" value="9876543210" />
    <input type="hidden" name="surl" value="http://localhost:3000/api/payment/success" />
    <input type="hidden" name="furl" value="http://localhost:3000/api/payment/failure" />
    <input type="hidden" name="hash" value="HASH_FROM_API" />
    <button type="submit">Pay Now</button>
  </form>
</body>
</html>
```

3. **PayU Test Cards:**
   - **Success:** Card: 5123456789012346, CVV: 123, Expiry: Any future date
   - **Failure:** Card: 4111111111111111, CVV: 123, Expiry: Any future date

### D. Test Webhook Handler
After payment, PayU will POST to `/api/webhooks/payu`:

**Manual Test:**
```bash
curl -X POST http://localhost:3000/api/webhooks/payu \
  -H "Content-Type: application/json" \
  -d '{
    "txnid": "txn_123",
    "status": "success",
    "amount": "999.00",
    "productinfo": "Premium Plan",
    "firstname": "Test",
    "email": "test@example.com",
    "phone": "9876543210",
    "hash": "VALID_HASH"
  }'
```

**Verify Database:**
```sql
-- Check subscription activated
SELECT status FROM subscriptions WHERE id = 'SUBSCRIPTION_ID';
-- Expected: active

-- Check payment event logged
SELECT * FROM payment_events WHERE transaction_id = 'txn_123';
-- Expected: 1 row with status = 'success'

-- Check usage quota initialized
SELECT * FROM usage_quotas 
WHERE organization_id = 'test-org-uuid' 
AND date = CURRENT_DATE;
-- Expected: 2 rows (signals, ai_prompts) with count = 0

-- Check webhook idempotency
SELECT * FROM webhook_events WHERE external_id = 'txn_123';
-- Expected: 1 row

-- Check subscription history
SELECT * FROM subscription_history WHERE subscription_id = 'SUBSCRIPTION_ID';
-- Expected: 2 rows (created → pending_payment, pending_payment → active)
```

### E. Test Idempotency
Send same webhook twice:
```bash
# Send same request again
curl -X POST http://localhost:3000/api/webhooks/payu \
  -H "Content-Type: application/json" \
  -d '{ ...same payload... }'
```

**Expected Response:**
```json
{
  "message": "Webhook already processed"
}
```

**Verify:** No duplicate payment_events or usage_quotas

---

## 4. AI Validation Testing

### A. Test Signal Validation
```bash
curl -X POST http://localhost:3000/api/ai/validate-signal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "symbol": "RELIANCE",
    "signal_type": "breakout",
    "signal_direction": "bullish",
    "entry_price": 2500.00,
    "current_price": 2525.00,
    "rsi_value": 65,
    "volume_ratio": 2.5,
    "pattern_name": "Double Bottom",
    "pattern_confidence": 85
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "validation": {
    "verdict": "BUY",
    "confidence": 0.85,
    "reasoning": "Strong bullish breakout with high volume...",
    "risk_factors": ["Overbought RSI at 65"],
    "entry_suggestion": "Consider entry on pullback to 2510"
  },
  "usage": {
    "tokens_used": 320,
    "cost_estimate": 0.000032
  }
}
```

**Verify Database:**
```sql
-- Check usage quota incremented
SELECT count FROM usage_quotas 
WHERE organization_id = 'test-org-uuid' 
AND metric_type = 'ai_prompts' 
AND date = CURRENT_DATE;
-- Expected: 1

-- Check usage metric logged
SELECT * FROM usage_metrics 
WHERE organization_id = 'test-org-uuid' 
AND metric = 'groq_api_call'
ORDER BY recorded_at DESC LIMIT 1;
-- Expected: value = 1

SELECT * FROM usage_metrics 
WHERE organization_id = 'test-org-uuid' 
AND metric = 'groq_tokens'
ORDER BY recorded_at DESC LIMIT 1;
-- Expected: value = 320 (or similar)
```

### B. Test Usage Limits
Send 51 AI validation requests (assuming limit = 50):

**Expected:** First 50 succeed, 51st returns:
```json
{
  "error": "AI prompt limit reached",
  "message": "Upgrade your plan to continue using AI features"
}
```

**Verify:**
```sql
SELECT count, limit_amount FROM usage_quotas 
WHERE organization_id = 'test-org-uuid' 
AND metric_type = 'ai_prompts' 
AND date = CURRENT_DATE;
-- Expected: count = 50, limit_amount = 50
```

### C. Test Groq Caching
Send same signal validation twice:
```bash
# First call - API request
curl -X POST http://localhost:3000/api/ai/validate-signal -d '{...}'

# Second call - cached response
curl -X POST http://localhost:3000/api/ai/validate-signal -d '{...}'
```

**Expected:** Second call returns faster (no API call to Groq)

**Check Logs:**
```
[Groq Cache] Cache miss, calling API  # First request
[Groq Cache] Cache hit                # Second request
```

---

## 5. Usage Tracking Testing

### A. Test Usage Tracking API
```bash
curl -X POST http://localhost:3000/api/usage/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "metric_type": "signals",
    "value": 1
  }'
```

**Expected Response:**
```json
{
  "success": true
}
```

**Verify Database:**
```sql
SELECT count FROM usage_quotas 
WHERE organization_id = 'test-org-uuid' 
AND metric_type = 'signals' 
AND date = CURRENT_DATE;
-- Expected: incremented by 1
```

### B. Test Client-Side Hook
```tsx
import { useTrackUsage } from '@/hooks/use-track-usage';

const { trackUsage, checkUsageLimit } = useTrackUsage();

// Check limit before action
const { canUse, current, limit, percentage } = await checkUsageLimit('signals');
console.log(`Can use: ${canUse}, Usage: ${current}/${limit} (${percentage}%)`);

if (canUse) {
  // Perform action
  await generateSignal();
  
  // Track usage
  await trackUsage('signals', 1);
}
```

---

## 6. Frontend Testing

### A. Test Billing Page (`/billing`)
1. Navigate to `http://localhost:3000/billing`
2. **Verify Display:**
   - [ ] Plan name shown
   - [ ] Status badge (Active/Pending/Failed)
   - [ ] Current period dates
   - [ ] Next billing date
   - [ ] Payment history table
   - [ ] Transaction IDs clickable

3. **Test Payment Success:**
   - Visit `/billing?payment=success&txnid=txn_123`
   - **Expected:** Green toast notification "Payment successful!"

4. **Test Payment Failure:**
   - Visit `/billing?payment=failed&error=Insufficient+funds`
   - **Expected:** Red toast notification "Payment failed: Insufficient funds"

### B. Test Subscription Page (`/subscription`)
1. Navigate to `http://localhost:3000/subscription`
2. **Verify Display:**
   - [ ] All plans loaded from database
   - [ ] Monthly/Yearly toggle works
   - [ ] Savings badge shows on yearly
   - [ ] Feature checklist displays
   - [ ] Popular plan badge shown

3. **Test Plan Selection:**
   - Click "Subscribe Now" on Premium plan
   - **Expected:** Redirects to PayU payment page

4. **Test Pricing Calculation:**
   - Toggle to Yearly
   - **Expected:** Price changes, savings shown
   - **Calculation:** (monthly * 12 - yearly) = savings

### C. Test Usage Page (`/usage`)
1. Navigate to `http://localhost:3000/usage`
2. **Verify Display:**
   - [ ] Signal quota with progress bar
   - [ ] AI quota with progress bar
   - [ ] 7-day usage summary
   - [ ] Token count and cost estimate

3. **Test Progress Colors:**
   - <75%: Blue (Healthy)
   - 75-89%: Yellow (Warning)
   - ≥90%: Red (Critical)

4. **Test Warning Alert:**
   - Use quota until 75%
   - **Expected:** Yellow warning alert appears
   - Use quota until 90%
   - **Expected:** Red critical alert appears

---

## 7. Batch AI Validation Testing

### A. Test Batch Job Manually
```bash
curl -X POST http://localhost:3000/api/cron/validate-signals \
  -H "Authorization: Bearer your_random_secret_change_in_production"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Batch AI validation completed",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Verify Logs:**
```
[Batch AI] Starting batch validation job...
[Batch AI] Processing 50 signals
[Batch AI] Batch completed: 50 success, 0 errors
```

**Verify Database:**
```sql
-- Check signals marked as validated
SELECT COUNT(*) FROM intraday_bearish_signals 
WHERE ai_validated = true;
-- Expected: 50 (or number processed)

-- Check AI fields populated
SELECT symbol, ai_verdict, ai_confidence, ai_reasoning 
FROM intraday_bearish_signals 
WHERE ai_validated = true LIMIT 5;
-- Expected: Valid data
```

### B. Test Cron Authentication
```bash
# Wrong secret
curl -X POST http://localhost:3000/api/cron/validate-signals \
  -H "Authorization: Bearer wrong_secret"
```

**Expected:** 401 Unauthorized

---

## 8. Error Handling Testing

### A. Test Expired Subscription
```sql
-- Expire subscription
UPDATE subscriptions 
SET status = 'expired', current_period_end = NOW() - INTERVAL '1 day'
WHERE organization_id = 'test-org-uuid';
```

**Try AI Validation:**
```bash
curl -X POST http://localhost:3000/api/ai/validate-signal ...
```

**Expected:** 429 Too Many Requests (limit reached since quota not active)

### B. Test Invalid Payment Hash
```bash
curl -X POST http://localhost:3000/api/webhooks/payu \
  -d '{
    "txnid": "txn_fake",
    "status": "success",
    "hash": "invalid_hash_123"
  }'
```

**Expected:** 400 Bad Request - "Invalid signature"

### C. Test Missing Organization
```bash
# Delete organization membership
DELETE FROM organization_members WHERE user_id = 'YOUR_USER_ID';

# Try to subscribe
curl -X POST http://localhost:3000/api/subscribe ...
```

**Expected:** 404 Not Found - "No organization found"

---

## 9. Performance Testing

### A. Load Test Webhook Endpoint
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Send 100 concurrent webhook requests
ab -n 1000 -c 100 -p webhook.json -T application/json \
  http://localhost:3000/api/webhooks/payu
```

**Monitor:**
- Response time < 500ms
- No duplicate processing (check webhook_events table)
- Database connections don't exhaust

### B. Test Usage Tracking Concurrency
Send 10 simultaneous usage tracking requests:
```javascript
const promises = Array(10).fill().map(() => 
  fetch('/api/usage/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metric_type: 'signals' })
  })
);

await Promise.all(promises);
```

**Verify:** Count incremented by exactly 10 (no race conditions)

---

## 10. Security Testing

### A. Test RLS Policies
```javascript
// Try to access another organization's subscription
const { data, error } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('organization_id', 'another-org-uuid');

console.log(data); // Should be empty or error
```

**Expected:** Empty result (RLS blocks access)

### B. Test API Authorization
```bash
# No token
curl -X POST http://localhost:3000/api/subscribe -d '{...}'
# Expected: 401 Unauthorized

# Invalid token
curl -X POST http://localhost:3000/api/subscribe \
  -H "Authorization: Bearer invalid_token" -d '{...}'
# Expected: 401 Unauthorized
```

### C. Test Payment Hash Tampering
```bash
# Change amount in webhook
curl -X POST http://localhost:3000/api/webhooks/payu \
  -d '{
    "txnid": "txn_123",
    "amount": "1.00",  # Changed from 999.00
    "hash": "ORIGINAL_HASH"
  }'
```

**Expected:** 400 Bad Request - "Invalid signature"

---

## 11. Production Readiness Checklist

### Database
- [ ] All migrations applied
- [ ] RLS policies active
- [ ] Indexes created
- [ ] Backup configured
- [ ] Connection pooling enabled

### API Routes
- [ ] All endpoints return proper status codes
- [ ] Error messages don't leak sensitive data
- [ ] CORS configured correctly
- [ ] Rate limiting implemented (optional)

### Security
- [ ] Service role key not exposed to frontend
- [ ] CRON_SECRET is strong random value
- [ ] PayU production credentials configured
- [ ] HTTPS enforced in production

### Monitoring
- [ ] Error tracking (Sentry/etc)
- [ ] API metrics dashboard
- [ ] Payment success rate tracking
- [ ] Groq API cost monitoring
- [ ] Database query performance

### Documentation
- [ ] API documentation complete
- [ ] Webhook URL shared with PayU
- [ ] Runbook for common issues
- [ ] Emergency contacts defined

---

## 12. Regression Test Suite

Run before every deployment:

```bash
# 1. Health check
curl http://localhost:3000/api/health

# 2. Create subscription
./test-scripts/create-subscription.sh

# 3. Process webhook
./test-scripts/test-webhook.sh

# 4. AI validation
./test-scripts/test-ai.sh

# 5. Usage tracking
./test-scripts/test-usage.sh

# 6. Frontend smoke test
npx playwright test
```

---

## 📊 Test Results Template

```markdown
## Test Run: [Date]
**Environment:** Local/Staging/Production
**Tester:** [Name]

| Test Category | Status | Notes |
|--------------|--------|-------|
| Database Setup | ✅ | All migrations applied |
| Payment Flow | ✅ | Test card successful |
| Webhook Handler | ✅ | Idempotency working |
| AI Validation | ✅ | Groq API responding |
| Usage Tracking | ✅ | Atomic increments |
| Frontend Pages | ✅ | All pages load |
| Batch Job | ✅ | Cron auth working |
| Security | ✅ | RLS policies active |

**Blockers:** None
**Next Steps:** Deploy to staging
```

---

## 🐛 Common Issues & Solutions

### Issue: Webhook returns "Already processed"
**Cause:** Duplicate txnid
**Solution:** Check webhook_events table, ensure unique transaction IDs

### Issue: AI validation returns 429
**Cause:** Daily limit reached
**Solution:** Check usage_quotas table, verify limit_amount

### Issue: Payment hash mismatch
**Cause:** Incorrect salt or key
**Solution:** Verify PAYU_MERCHANT_SALT in .env matches PayU dashboard

### Issue: RLS blocks authenticated user
**Cause:** User not in organization_members
**Solution:** Insert membership record linking user to organization

---

*Testing Guide Complete*
*Last Updated: 2024*

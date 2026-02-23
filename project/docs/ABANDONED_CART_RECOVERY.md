# Abandoned Cart Recovery System

## Overview
The early capture system automatically saves draft orders as soon as users complete Step 2 (The Brief), enabling powerful abandoned cart recovery and retargeting campaigns.

## How It Works

### 1. Data Capture Point
**Trigger:** When user clicks "Continue" on Step 2 (The Brief)

**Captured Data:**
- Email address (required)
- Sonic reference URL (required)
- Usage type (optional)
- Project description (optional)
- Music vibe/genre (from Step 1)

### 2. Database Flow

#### First-Time Save
When a user completes Step 2 for the first time:
```typescript
INSERT INTO orders (
  order_type = 'music',
  status = 'draft',
  email = user_email,
  music_vibe = selected_vibe,
  sonic_reference_url = reference_link,
  usage_type = selected_usage,
  script_text = description,
  project_name = 'Music Draft - [vibe]'
)
```

#### Update on Return
If the user goes back and modifies their input:
```typescript
UPDATE orders
SET
  sonic_reference_url = new_reference,
  usage_type = new_usage,
  script_text = new_description,
  updated_at = now()
WHERE id = draft_order_id
```

#### Tier Selection Update
When user selects a tier in Step 3:
```typescript
UPDATE orders
SET tier = selected_tier_id
WHERE id = draft_order_id
```

### 3. Status Progression

```
draft → pending → processing → completed
  ↓
failed (if payment/processing fails)
```

- **draft**: User entered brief but didn't complete checkout
- **pending**: User completed payment, awaiting production
- **processing**: Order is being produced
- **completed**: Deliverable ready for download
- **failed**: Payment or production failed

## User Experience

### Optimistic UI
- Save happens asynchronously in background
- Does NOT block transition to next step
- Shows subtle "Saving..." indicator on Continue button
- User proceeds immediately even if save is still in progress

### Session Management
- `draftOrderId` stored in component state
- Persists during current wizard session
- Lost on page refresh (by design - prevents stale drafts)
- New draft created if user returns and starts fresh

## Marketing Use Cases

### 1. Abandoned Brief Recovery
**Scenario:** User enters email + reference link but drops off at Step 3 (pricing)

**Recovery Actions:**
- Send follow-up email with saved reference link
- Offer limited-time discount to complete order
- Share tier comparison to help decision

**Query:**
```sql
SELECT * FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND created_at > now() - interval '7 days'
  AND updated_at < now() - interval '24 hours'
ORDER BY created_at DESC;
```

### 2. Tier Hesitation Recovery
**Scenario:** User viewed all tiers but didn't select one

**Recovery Actions:**
- Send tier comparison guide via email
- Highlight most popular tier
- Answer common licensing questions

**Query:**
```sql
SELECT * FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND tier = 'N/A'
  AND created_at > now() - interval '3 days'
ORDER BY created_at DESC;
```

### 3. Reference Link Analysis
**Scenario:** Analyze popular reference tracks to inform marketing

**Query:**
```sql
SELECT
  sonic_reference_url,
  COUNT(*) as reference_count,
  music_vibe,
  COUNT(DISTINCT email) as unique_users
FROM orders
WHERE order_type = 'music'
  AND sonic_reference_url IS NOT NULL
GROUP BY sonic_reference_url, music_vibe
ORDER BY reference_count DESC
LIMIT 50;
```

## Security & Privacy

### RLS Policies
- **Insert:** Anyone (anon/authenticated) can create draft orders
- **Select:** Users can only view orders matching their email
- **Update:** Authenticated users can update their own orders
- **Delete:** Not implemented (soft delete via status recommended)

### PII Handling
- Email addresses stored in lowercase for consistency
- Draft orders auto-expire after 30 days (implement cleanup job)
- No credit card data stored in draft status
- GDPR-compliant: users can request deletion

### Anonymous Users
- System works for both logged-in and guest users
- No authentication required for draft creation
- Email serves as primary identifier
- Session-based tracking prevents duplicate drafts during single wizard flow

## Implementation Details

### Frontend State Management
```typescript
const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
const [isSavingDraft, setIsSavingDraft] = useState(false);
```

### Validation
- Email: RFC 5322 regex validation
- Sonic Reference URL: Must contain youtube.com, spotify.com, or soundcloud.com
- Both fields required before draft creation

### Error Handling
- Silent failures logged to console
- User can proceed even if draft save fails
- Retry logic NOT implemented (single attempt per action)
- No user-facing error messages for draft save failures

## Future Enhancements

### Recommended Improvements
1. **Auto-save on field blur** - Save draft as user types (debounced)
2. **Session recovery** - Store `draftOrderId` in localStorage to survive page refresh
3. **Draft cleanup job** - Automated deletion of drafts older than 30 days
4. **A/B test campaigns** - Test different recovery email strategies
5. **Conversion funnel analytics** - Track step-by-step drop-off rates
6. **Pre-fill on return** - Allow users to resume abandoned drafts via email link

### Email Templates
Create targeted recovery emails:
- **24hr follow-up**: "Still thinking about your project?"
- **3-day reminder**: "Your reference track is waiting"
- **7-day last chance**: "Save 15% if you complete today"

## Testing

### Manual Test Flow
1. Navigate to `/music/create`
2. Select a vibe (Step 1)
3. Enter email + reference URL (Step 2)
4. Click Continue
5. Check database: `SELECT * FROM orders WHERE email = 'test@example.com' AND status = 'draft'`
6. Go back to Step 2, change reference URL
7. Click Continue
8. Check database: order should be updated (updated_at changed)
9. Select a tier (Step 3)
10. Check database: tier field should be updated

### Automated Tests (TODO)
```typescript
describe('Early Capture System', () => {
  it('should create draft order on Step 2 completion', async () => {
    // Test implementation
  });

  it('should update existing draft when user goes back', async () => {
    // Test implementation
  });

  it('should validate email format', () => {
    // Test implementation
  });
});
```

## Monitoring

### Key Metrics
- **Draft Creation Rate**: % of users who complete Step 2
- **Draft→Pending Conversion**: % of drafts that become paid orders
- **Time to Conversion**: Hours between draft creation and order completion
- **Recovery Email Effectiveness**: Open rate, click rate, conversion rate

### Database Queries for Analytics
```sql
-- Daily draft creation volume
SELECT
  DATE(created_at) as date,
  COUNT(*) as drafts_created
FROM orders
WHERE status = 'draft' AND order_type = 'music'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Conversion rate: draft → pending
SELECT
  COUNT(CASE WHEN status = 'draft' THEN 1 END) as drafts,
  COUNT(CASE WHEN status IN ('pending', 'processing', 'completed') THEN 1 END) as converted,
  ROUND(100.0 * COUNT(CASE WHEN status IN ('pending', 'processing', 'completed') THEN 1 END) /
    NULLIF(COUNT(CASE WHEN status = 'draft' THEN 1 END), 0), 2) as conversion_rate
FROM orders
WHERE order_type = 'music'
  AND created_at > now() - interval '30 days';
```

## Support

For questions or issues with the abandoned cart recovery system, contact the backend team or check the Supabase dashboard for real-time draft order monitoring.

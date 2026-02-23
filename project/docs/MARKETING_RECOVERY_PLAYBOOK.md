# Marketing Recovery Playbook
**Abandoned Cart Recovery for Music Production Orders**

## Quick Start Guide

### What Gets Captured?
As soon as a user completes "The Brief" (Step 2), we capture:
- ✅ Email address
- ✅ Reference track URL (YouTube/Spotify/SoundCloud)
- ✅ Music vibe preference
- ✅ Usage type (Commercial Ad, Social Media, etc.)
- ✅ Project description

**Status:** `draft` in database

### Why This Matters
Users who provide their email + reference link have **high purchase intent** but need a nudge to complete the order.

---

## Recovery Campaigns

### Campaign 1: 24-Hour Follow-Up
**Target:** Drafts created 24-48 hours ago, no tier selected

**Subject Line:** "Your music project is waiting, [Name]"

**Email Body:**
```
Hi there,

We noticed you started creating a custom music track inspired by:
[Reference Track URL]

We've saved your project details. Ready to bring your vision to life?

[Complete Your Order Button]

Need help choosing the right tier? Reply to this email and we'll guide you.

- The Onyx Team
```

**SQL Query:**
```sql
SELECT email, music_vibe, sonic_reference_url, created_at
FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND tier = 'N/A'
  AND created_at BETWEEN now() - interval '48 hours' AND now() - interval '24 hours';
```

---

### Campaign 2: 3-Day Reminder with Social Proof
**Target:** Drafts created 3-4 days ago, still incomplete

**Subject Line:** "Join 500+ creators who trusted us with their sound"

**Email Body:**
```
Hi there,

Your custom music project for [Music Vibe] is still saved!

Why creators choose Onyx:
✓ Master rights included (Pro Studio tier)
✓ Full copyright buyout available (Masterpiece tier)
✓ Average 7-day turnaround
✓ Unlimited revisions

[View Pricing & Complete Order]

P.S. Your reference track: [URL]
We're excited to create something amazing for you!
```

**SQL Query:**
```sql
SELECT email, music_vibe, sonic_reference_url, usage_type, created_at
FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND created_at BETWEEN now() - interval '4 days' AND now() - interval '3 days';
```

---

### Campaign 3: 7-Day Last Chance (15% Discount)
**Target:** Drafts created 7 days ago, likely to abandon

**Subject Line:** "⏰ Save 15% on your custom music - expires tonight"

**Email Body:**
```
Hi there,

We'd love to help you complete your music project.

Special offer for you:
🎵 15% OFF any tier
🎵 Valid for 24 hours only
🎵 Code: COMPLETE15

Your saved project:
- Vibe: [Music Vibe]
- Reference: [URL]
- Usage: [Usage Type]

[Claim Your Discount & Complete Order]

This offer expires in 24 hours. Let's make your vision a reality!
```

**SQL Query:**
```sql
SELECT email, music_vibe, sonic_reference_url, usage_type, created_at
FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND created_at BETWEEN now() - interval '8 days' AND now() - interval '7 days';
```

---

## Segmented Campaigns

### Segment A: High-Value Commercial Users
**Filter:** `usage_type = 'Commercial Advertisement'`

**Strategy:** Emphasize master rights and copyright buyout options. Highlight case studies from major brands.

**Email Hook:** "Your commercial ad deserves production-ready music with full rights"

---

### Segment B: Content Creators (YouTube/Social Media)
**Filter:** `usage_type IN ('Social Media Content', 'YouTube Content')`

**Strategy:** Focus on speed, affordability, and broad usage rights. Show creator testimonials.

**Email Hook:** "Royalty-free music for your next viral video"

---

### Segment C: Film/TV Production
**Filter:** `usage_type = 'Film/TV Production'`

**Strategy:** Professional tone, emphasize sync licensing and cinematic quality. Offer consultation call.

**Email Hook:** "Professional scoring for your production - let's talk"

---

## Advanced Tactics

### Tactic 1: Reference Track Analysis
Identify trending reference tracks and create case studies.

**Query:**
```sql
SELECT
  sonic_reference_url,
  COUNT(*) as times_referenced,
  music_vibe,
  COUNT(DISTINCT email) as unique_users
FROM orders
WHERE order_type = 'music'
  AND sonic_reference_url IS NOT NULL
  AND created_at > now() - interval '30 days'
GROUP BY sonic_reference_url, music_vibe
HAVING COUNT(*) >= 3
ORDER BY times_referenced DESC;
```

**Use Case:** "5 creators wanted music like [Popular Track] - here's what we delivered"

---

### Tactic 2: Vibe-Based Upsells
If user selected budget tier but chose complex vibe (e.g., Cinematic Orchestral), suggest upgrade.

**Query:**
```sql
SELECT email, music_vibe, tier, sonic_reference_url
FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND tier = 'ai-curator'
  AND music_vibe IN ('Cinematic Orchestral', 'Epic Trailer')
  AND created_at > now() - interval '48 hours';
```

**Email Hook:** "Your [Cinematic Orchestral] vision deserves Pro Studio quality"

---

### Tactic 3: Re-Engagement Win-Back
For drafts older than 30 days, run a "We Miss You" campaign.

**Query:**
```sql
SELECT email, music_vibe, created_at
FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND created_at BETWEEN now() - interval '90 days' AND now() - interval '30 days'
ORDER BY created_at DESC;
```

**Email Hook:** "Still need music? Your project is waiting (+ 20% off)"

---

## A/B Testing Ideas

### Test 1: Subject Line Variants
- A: "Your music project is waiting"
- B: "Ready to complete your custom track?"
- C: "We saved your [Music Vibe] project"

**Metric:** Open rate

---

### Test 2: CTA Button Copy
- A: "Complete Your Order"
- B: "Resume My Project"
- C: "Get My Custom Music"

**Metric:** Click-through rate

---

### Test 3: Discount Timing
- A: 15% off at 3 days
- B: 15% off at 7 days
- C: 10% off at 3 days, 20% off at 7 days

**Metric:** Conversion rate

---

## Key Performance Indicators (KPIs)

### Primary Metrics
| Metric | Target | Formula |
|--------|--------|---------|
| Draft Creation Rate | 60% | (Step 2 completions / Step 1 completions) × 100 |
| Draft→Order Conversion | 25% | (Orders / Drafts) × 100 |
| Email Open Rate | 30% | (Opens / Sent) × 100 |
| Email Click Rate | 8% | (Clicks / Opens) × 100 |
| Recovery Conversion | 12% | (Orders from email / Email recipients) × 100 |

### Secondary Metrics
- Average time from draft to order
- Most common drop-off point (tier selection vs final checkout)
- Revenue recovered via abandoned cart emails
- Lifetime value of recovered customers

---

## Campaign Calendar

### Week 1: Setup & Data Collection
- [ ] Export all draft orders from past 30 days
- [ ] Segment by usage type and vibe
- [ ] Set up email automation in marketing platform

### Week 2: Launch Phase 1
- [ ] Send 24-hour follow-up to recent drafts
- [ ] Monitor open and click rates
- [ ] A/B test subject lines

### Week 3: Optimize & Scale
- [ ] Analyze Week 2 results
- [ ] Launch 3-day and 7-day campaigns
- [ ] Implement winning variants

### Week 4: Advanced Segmentation
- [ ] Launch vibe-specific campaigns
- [ ] Test discount offers
- [ ] Create case studies from popular reference tracks

---

## Tools & Integrations

### Recommended Marketing Stack
1. **Email Platform:** Mailchimp / SendGrid / Customer.io
2. **Analytics:** Mixpanel / Amplitude for funnel tracking
3. **A/B Testing:** Optimizely / VWO
4. **CRM:** HubSpot / Salesforce for high-value leads

### Supabase Integration
Use Supabase REST API or webhooks to sync draft data to your marketing platform:

```javascript
// Example: Fetch drafts for email campaign
const { data, error } = await supabase
  .from('orders')
  .select('email, music_vibe, sonic_reference_url, created_at')
  .eq('status', 'draft')
  .eq('order_type', 'music')
  .gte('created_at', '2024-01-01')
  .lte('created_at', '2024-01-31');
```

---

## Legal & Compliance

### GDPR Considerations
- ✅ Users explicitly provided email (required field)
- ✅ Clear purpose: Order completion and project delivery
- ⚠️ Include unsubscribe link in all recovery emails
- ⚠️ Honor deletion requests within 30 days

### CAN-SPAM Compliance
- ✅ Include physical mailing address
- ✅ Clear identification as marketing email
- ✅ Honor opt-out requests within 10 days
- ✅ Accurate subject lines (no deceptive headers)

### Email Copy Checklist
- [ ] Unsubscribe link in footer
- [ ] Physical address included
- [ ] "Why am I receiving this?" explanation
- [ ] Clear CTA and no misleading claims
- [ ] GDPR-compliant privacy policy link

---

## FAQ for Marketing Team

**Q: How soon after draft creation should we send the first email?**
A: Wait 24 hours. Gives user time to complete naturally, avoids being pushy.

**Q: Can we send multiple emails to the same draft?**
A: Yes, but space them out (24h → 3d → 7d). Avoid email fatigue.

**Q: What if a user unsubscribes?**
A: Respect it immediately. Mark their email in a suppression list. However, transactional emails (order confirmations) can still be sent.

**Q: Should we include the actual reference track in the email?**
A: Link to it, but don't embed (copyright issues). Text: "Your reference: [Track Name]"

**Q: What if the draft has no usage_type or description?**
A: Still valuable! Focus on the vibe and reference URL. Offer to help them fill in details.

**Q: Can we call high-value drafts (Film/TV)?**
A: Yes! For commercial/enterprise usage types, phone outreach can be highly effective.

---

## Success Stories (Template)

Document successful recovery campaigns to refine strategy:

**Campaign:** 7-Day Discount Email (15% off)
**Date:** January 2024
**Recipients:** 450 draft orders
**Results:**
- Open Rate: 32%
- Click Rate: 11%
- Conversions: 54 orders (12% recovery rate)
- Revenue: $89,460
- ROI: 4,473% (cost of email campaign vs. revenue)

**Key Learnings:**
- Discount incentive significantly boosted conversion
- Subject line with emoji performed 18% better
- Mobile open rate was 68% (optimize for mobile!)

---

## Next Steps

1. **Access Supabase Dashboard** - Familiarize yourself with draft order data
2. **Set Up Email Sequences** - Use the campaigns above as templates
3. **Track & Optimize** - Monitor KPIs weekly, iterate on copy/timing
4. **Scale What Works** - Once you find winning campaigns, automate them

Need help accessing the database or setting up integrations? Contact the engineering team.

---

**Document Owner:** Marketing Team
**Last Updated:** 2024
**Review Cadence:** Monthly

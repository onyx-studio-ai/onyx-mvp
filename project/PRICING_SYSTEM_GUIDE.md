# Centralized Pricing System Guide

## Overview
The Onyx platform now has a **CEO-proof pricing system** where all prices are managed from a single configuration file. This makes it easy to update prices without touching any code logic.

---

## 🎯 Single Source of Truth

**File Location:** `/lib/config/pricing.config.ts`

This file controls ALL pricing across:
- Music service (`/music/create`)
- Voice service (`/voice/create`)

---

## 📝 How to Edit Prices (For Non-Technical Users)

1. Open the file: `/lib/config/pricing.config.ts`
2. Look for sections marked with `← EDIT HERE`
3. Change only the NUMBER values
4. Save the file
5. Rebuild the project with `npm run build`

### ⚠️ Important Rules:
- ✅ Only change the numbers
- ✅ Keep prices as whole numbers (no quotes, no $)
- ❌ DO NOT change variable names
- ❌ DO NOT change the structure
- ❌ DO NOT edit anything below "DO NOT EDIT BELOW THIS LINE"

---

## 🎵 Music Service Pricing

### Base Tiers
```typescript
AI Curator: $999
Pro Arrangement: $2,499  // ← Edit here
Masterpiece: $4,999
```

### String Add-ons (Optional)
```typescript
Intimate Ensemble (12 players): +$599
Rich Studio Strings (16 players): +$749  // ← Edit here
Cinematic Symphony (24 players): +$1,099
```

### Talent Pricing
- Fetched dynamically from Supabase `talents` table
- Each singer has their own `frontend_price`

### Calculation Formula
```
Total = Base Tier + String Add-on (if selected) + Talent Price (if selected)
```

---

## 🎤 Voice Service Pricing

### Base Tiers
```typescript
Essential: $299       // Up to 500 words
Professional: $799    // Up to 1,000 words (MOST POPULAR)
Premium: $1,499       // Unlimited words
```

### Word Count Charges
```typescript
Extra words beyond tier limit: $0.50 per word  // ← Edit here
```

### Usage Rights (Optional Add-ons)
```typescript
Social Media Rights: $0 (Included)
Broadcast TV Rights: +$500
Global Advertising: +$1,000  // ← Edit here
```

### Talent Pricing
- Fetched dynamically from Supabase `talents` table (type='voice_actor')
- Each voice actor has their own `frontend_price`

### Calculation Formula
```
Total = Base Tier
      + Extra Word Charges (if over limit)
      + Usage Rights (if selected)
      + Talent Price (if selected)
```

---

## 🔒 Locked Calculation Logic

The pricing calculations are handled by these functions:

### For Music:
```typescript
calculateMusicTotal({
  baseTierId: 'pro-arrangement',
  stringAddonId: 'rich-studio-strings',
  talentPrice: 1200
})
// Returns: 2499 + 749 + 1200 = $4,448
```

### For Voice:
```typescript
calculateVoiceTotal({
  baseTierId: 'professional',
  wordCount: 1500,  // 500 words over limit
  usageRightIds: ['broadcast-tv'],
  talentPrice: 800
})
// Returns: 799 + (500 * 0.50) + 500 + 800 = $2,349
```

---

## 🎨 UI Consistency

Both Music and Voice configurators share:
- **Same layout structure** (3-column grid with sticky sidebar)
- **Same color theming** (Music: purple/pink, Voice: blue/cyan)
- **Same interaction patterns** (selection cards, checkboxes)
- **Same checkout flow** (TapPay integration)

---

## 📊 Example Price Changes

### Scenario: Increase Music Pro Tier by $500

**Before:**
```typescript
{
  id: 'pro-arrangement',
  name: 'Pro Arrangement',
  price: 2499,  // ← Current price
  ...
}
```

**After:**
```typescript
{
  id: 'pro-arrangement',
  name: 'Pro Arrangement',
  price: 2999,  // ← New price (+$500)
  ...
}
```

**Result:** All pages showing Pro Arrangement pricing will automatically update to $2,999.

---

## 🚀 Testing Your Changes

After editing prices:

1. **Verify the config file:**
   ```bash
   cat lib/config/pricing.config.ts
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Check for errors:**
   - If build succeeds ✅ → Changes are good
   - If build fails ❌ → Undo changes and try again

4. **Test in browser:**
   - Navigate to `/music/create`
   - Navigate to `/voice/create`
   - Verify pricing displays correctly

---

## 🛡️ Safety Features

1. **Type Safety:** TypeScript ensures all values are numbers
2. **Centralized Logic:** Math functions are locked and protected
3. **No Duplicate Code:** Prices defined once, used everywhere
4. **Easy Rollback:** Git version control tracks all changes

---

## 📞 Support

If you need to make complex changes beyond simple price updates:
- Contact a developer
- They can modify tier structures, add new options, or adjust calculation logic
- But 95% of pricing updates can be done by editing the config file alone!

---

## ✅ Quick Checklist

Before deploying price changes:

- [ ] Only edited NUMBER values in pricing.config.ts
- [ ] Did NOT change variable names or structure
- [ ] Ran `npm run build` successfully
- [ ] Tested both /music/create and /voice/create pages
- [ ] Verified sidebar pricing calculations are correct
- [ ] Confirmed checkout totals match expectations

---

**Last Updated:** 2026-02-16
**Version:** 1.0
**Status:** Production Ready ✅

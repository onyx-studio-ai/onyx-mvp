# TapPay Payment Integration Guide

This document explains how to set up and use the TapPay payment integration for the Music Wizard.

## Overview

The Music Wizard now includes a complete TapPay (Taiwan Payment Gateway) integration in **Sandbox Mode** for testing payments. The integration includes:

1. **Draft Order Saving** - Captures user data early for abandoned cart recovery
2. **Secure Card Fields** - TapPay's PCI-compliant hosted iframes for card data
3. **Server-Side Payment Processing** - Backend API handles payment with TapPay

## Setup Instructions

### 1. Get TapPay Sandbox Credentials

1. Sign up for a TapPay account at [TapPay Portal](https://portal.tappaysdk.com/)
2. Navigate to the Sandbox environment
3. Obtain the following credentials:
   - **App ID** (for frontend)
   - **App Key** (for frontend)
   - **Partner Key** (for backend)
   - **Merchant ID** (for backend)

### 2. Configure Environment Variables

Update your `.env.local` file with your TapPay credentials:

```bash
# TapPay Sandbox Credentials (Frontend)
NEXT_PUBLIC_TAPPAY_APP_ID=your_actual_app_id_here
NEXT_PUBLIC_TAPPAY_APP_KEY=your_actual_app_key_here

# TapPay Sandbox Credentials (Backend)
TAPPAY_PARTNER_KEY=your_actual_partner_key_here
TAPPAY_MERCHANT_ID=your_actual_merchant_id_here
```

**Important:** Never commit real credentials to version control. The `.env` file contains placeholders only.

### 3. Test the Integration

The integration is ready to use once credentials are configured.

**Test Card Details (Sandbox Mode):**
- **Card Number:** `4242 4242 4242 4242`
- **Expiration Date:** Any future date (e.g., `12/25`)
- **CCV:** Any 3 digits (e.g., `123`)
- **Cardholder Name:** Any name

## User Flow

### Step 1: The Hook (Data Capture)
Users enter:
- Email address (required for magic login)
- Music vibe selection
- Sonic reference URL (YouTube/Spotify/SoundCloud)
- Usage type (optional)
- Project description

When the user clicks "Continue," the system:
1. Validates all required fields
2. Makes API call to `POST /api/orders/draft`
3. Creates/updates order with `status='draft'`
4. Returns `orderId` for tracking
5. Proceeds to Step 2

**Purpose:** This enables abandoned cart recovery. Marketing can target users who didn't complete payment.

### Step 2: Tier Selection
User selects production tier:
- AI Curator ($999)
- Pro Studio ($2,499)
- Masterpiece ($4,999)

The tier is updated in the draft order immediately.

### Step 3: Review & Payment (TapPay Integration)
User sees:
1. **Order Summary** - All details and total price
2. **Payment Form** - TapPay secure fields:
   - Cardholder name (regular input)
   - Card number (TapPay iframe)
   - Expiration date (TapPay iframe)
   - CCV (TapPay iframe)
3. **Legal Checkbox** - Terms & Privacy Policy agreement

When user clicks "Pay [Amount]":
1. Frontend validates cardholder name
2. Calls `TPDirect.card.getPrime()` to get secure token
3. Makes API call to `POST /api/payment/pay` with:
   - `prime` (TapPay token)
   - `orderId`
   - `amount`
   - `cardholder` name
4. Backend processes payment with TapPay
5. Updates order status to `pending` on success
6. Redirects to success page

### Step 4: Success Page
- Order confirmation with details
- Post-purchase survey (3 questions)
- Links to dashboard and support

## API Endpoints

### POST /api/orders/draft

Creates or updates a draft order for abandoned cart recovery.

**Request Body:**
```json
{
  "orderId": "uuid-or-null",
  "email": "user@example.com",
  "vibe": "Cyberpunk Pop",
  "sonicRefUrl": "https://youtube.com/watch?v=...",
  "usageType": "Commercial Advertisement",
  "description": "Project description...",
  "tier": "pro-studio"
}
```

**Response:**
```json
{
  "orderId": "uuid",
  "created": true
}
```

### POST /api/payment/pay

Processes payment using TapPay Pay by Prime API.

**Request Body:**
```json
{
  "prime": "tappay_prime_token",
  "orderId": "uuid",
  "amount": 2499,
  "cardholder": {
    "name": "John Doe"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "transactionId": "tappay_transaction_id",
  "orderId": "uuid"
}
```

**Response (Error):**
```json
{
  "error": "Payment failed",
  "message": "Insufficient funds"
}
```

## TapPay Integration Details

### Frontend (Client-Side)

The TapPay SDK is loaded dynamically when the user reaches Step 3:

```javascript
// Load SDK script
<script src="https://js.tappaysdk.com/tpdirect/v5.14.0"></script>

// Initialize SDK
TPDirect.setupSDK(APP_ID, APP_KEY, 'sandbox');

// Setup secure card fields
TPDirect.card.setup({
  fields: {
    number: { element: '#card-number', placeholder: '**** **** **** ****' },
    expirationDate: { element: '#card-expiration-date', placeholder: 'MM / YY' },
    ccv: { element: '#card-ccv', placeholder: 'CCV' }
  },
  styles: {
    // Dark mode styling
  }
});

// Get prime token on payment
TPDirect.card.getPrime((result) => {
  if (result.status === 0) {
    const prime = result.card.prime;
    // Send to backend
  }
});
```

### Backend (Server-Side)

The payment API calls TapPay's Pay by Prime endpoint:

```javascript
const response = await fetch('https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': TAPPAY_PARTNER_KEY
  },
  body: JSON.stringify({
    prime,
    partner_key: TAPPAY_PARTNER_KEY,
    merchant_id: TAPPAY_MERCHANT_ID,
    details: `Music Order #${orderId}`,
    amount: Math.round(amount),
    cardholder: {
      phone_number: '+886912345678',
      name: cardholderName,
      email: orderEmail
    },
    remember: false
  })
});
```

## Security Features

1. **PCI Compliance:** Card data never touches our servers (handled by TapPay iframes)
2. **Prime Tokens:** One-time use tokens instead of raw card data
3. **Server-Side Processing:** Payment processing happens on the backend
4. **HTTPS Only:** All API calls use secure connections
5. **Environment Variables:** Sensitive keys stored securely

## Abandoned Cart Recovery

Orders with `status='draft'` represent abandoned carts. Marketing can query these for recovery:

```sql
-- Get recent abandoned carts
SELECT *
FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;

-- Get high-value abandoned carts
SELECT *
FROM orders
WHERE status = 'draft'
  AND order_type = 'music'
  AND tier IN ('pro-studio', 'masterpiece')
  AND created_at > now() - interval '7 days';
```

## Fallback Mode

If TapPay credentials are not configured, the system falls back to:
- Mock payment processing
- Direct order status update
- Still captures all data for testing

## Testing Checklist

- [ ] Draft order saved on Step 1 completion
- [ ] Order updated when tier selected
- [ ] TapPay fields load and style correctly
- [ ] Test card payment succeeds
- [ ] Order status updates to `pending` on success
- [ ] Success page displays with survey
- [ ] Error handling works for invalid cards
- [ ] Abandoned cart data captured in database

## Production Deployment

When ready for production:

1. Get production TapPay credentials
2. Update environment variables with production keys
3. Change SDK initialization from `'sandbox'` to `'production'`
4. Update TapPay API endpoint from sandbox to production
5. Test with small real transaction
6. Monitor error logs and transaction success rates

## Troubleshooting

**TapPay fields not showing:**
- Check browser console for errors
- Verify environment variables are set
- Ensure script loads successfully

**Payment fails:**
- Check backend logs for TapPay API errors
- Verify Partner Key and Merchant ID
- Test with known working card (4242...)

**Draft orders not saving:**
- Check API logs at `/api/orders/draft`
- Verify Supabase connection
- Check database permissions

## Support

- TapPay Documentation: https://docs.tappaysdk.com/
- TapPay Support: support@tappaysdk.com
- Sandbox Portal: https://portal.tappaysdk.com/

## Summary

This integration provides:
- ✅ Early data capture for marketing
- ✅ Secure PCI-compliant payment processing
- ✅ Real payment gateway (TapPay Taiwan)
- ✅ Abandoned cart recovery capability
- ✅ Post-purchase survey for feedback
- ✅ Complete payment flow from draft to confirmation

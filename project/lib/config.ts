export const SUPABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
}

export const TAPPAY_CONFIG = {
  appId: process.env.NEXT_PUBLIC_TAPPAY_APP_ID!,
  appKey: process.env.NEXT_PUBLIC_TAPPAY_PARTNER_KEY!,
  partnerKey: process.env.TAPPAY_PARTNER_KEY!,
  merchantId: process.env.TAPPAY_MERCHANT_ID!,
  environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
}

export const ADMIN_CONFIG = {
  code: process.env.ADMIN_CODE!,
}

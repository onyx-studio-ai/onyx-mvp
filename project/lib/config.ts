export const SUPABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
}

const paddleEnvironment = process.env.PADDLE_ENV || process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox';

export const PADDLE_CONFIG = {
  environment: (paddleEnvironment === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
  apiKey: process.env.PADDLE_API_KEY || '',
  webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || '',
  // Paddle.js client-side token is optional for hosted URL flow, but kept for future needs.
  clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '',
}

export const ADMIN_CONFIG = {
  code: process.env.ADMIN_CODE!,
}

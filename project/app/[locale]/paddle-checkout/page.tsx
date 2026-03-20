'use client';

import { useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    Paddle?: {
      Environment?: {
        set: (environment: 'sandbox' | 'production') => void;
      };
      Initialize?: (params: { token: string; eventCallback?: (event: unknown) => void }) => void;
    };
  }
}

const PUBLIC_PADDLE_ENV =
  process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox';
const PUBLIC_PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';

export default function PaddleCheckoutPage() {
  const searchParams = useSearchParams();
  const [statusText, setStatusText] = useState('正在啟動安全付款頁面...');

  const transactionId = useMemo(
    () => searchParams.get('_ptxn') || searchParams.get('transaction_id') || '',
    [searchParams],
  );

  useEffect(() => {
    if (!transactionId) {
      setStatusText('找不到交易資訊，請回到結帳頁重新發起付款。');
      return;
    }

    const timeout = setTimeout(() => {
      setStatusText('若付款視窗未自動開啟，請確認瀏覽器未封鎖彈出視窗，然後重新嘗試。');
    }, 7000);

    return () => clearTimeout(timeout);
  }, [transactionId]);

  const initializePaddle = () => {
    if (!window.Paddle) {
      setStatusText('付款元件載入失敗，請重新整理頁面。');
      return;
    }

    if (window.Paddle.Environment?.set) {
      window.Paddle.Environment.set(PUBLIC_PADDLE_ENV);
    }

    // For hosted checkout links (_ptxn), including Paddle.js is usually enough.
    // Initialize is optional here but helps keep behavior explicit when token exists.
    if (PUBLIC_PADDLE_CLIENT_TOKEN && window.Paddle.Initialize) {
      window.Paddle.Initialize({
        token: PUBLIC_PADDLE_CLIENT_TOKEN,
      });
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-4">
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={initializePaddle}
      />

      <div className="max-w-xl w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 mb-4">
          <Loader2 className="w-6 h-6 text-blue-300 animate-spin" />
        </div>
        <h1 className="text-xl font-semibold mb-2">正在前往 Paddle 安全付款</h1>
        <p className="text-sm text-gray-300">{statusText}</p>
        <p className="mt-4 text-xs text-gray-500 break-all">
          Transaction: {transactionId || 'N/A'}
        </p>
      </div>
    </main>
  );
}

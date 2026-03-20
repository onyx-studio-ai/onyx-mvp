'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
      Checkout?: {
        open: (params: { transactionId: string }) => void;
      };
    };
  }
}

const PUBLIC_PADDLE_ENV =
  process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox';
const PUBLIC_PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';

export default function PaddleCheckoutPage() {
  const searchParams = useSearchParams();
  const [statusText, setStatusText] = useState('正在啟動安全付款頁面...');
  const [scriptReady, setScriptReady] = useState(false);
  const completedRef = useRef(false);

  const transactionId = useMemo(
    () => searchParams.get('_ptxn') || searchParams.get('transaction_id') || '',
    [searchParams],
  );
  const successUrl = useMemo(() => searchParams.get('success_url') || '', [searchParams]);
  const cancelUrl = useMemo(() => searchParams.get('cancel_url') || '', [searchParams]);

  const safeRedirect = (targetUrl: string, fallbackPath: string) => {
    if (typeof window === 'undefined') return;
    if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
      window.location.assign(targetUrl);
      return;
    }
    window.location.assign(fallbackPath);
  };

  useEffect(() => {
    if (!scriptReady) return;

    if (!transactionId) {
      setStatusText('找不到交易資訊，請回到結帳頁重新發起付款。');
      return;
    }

    if (!PUBLIC_PADDLE_CLIENT_TOKEN) {
      setStatusText('付款元件尚未完成設定，請聯絡管理員補上 NEXT_PUBLIC_PADDLE_CLIENT_TOKEN。');
      return;
    }

    if (!window.Paddle?.Checkout?.open) {
      setStatusText('付款元件載入失敗，請重新整理頁面。');
      return;
    }

    setStatusText('正在開啟 Paddle 付款視窗...');
    try {
      window.Paddle.Checkout.open({ transactionId });
    } catch (error) {
      console.error('[Paddle Checkout Page] Open failed:', error);
      setStatusText('無法開啟付款視窗，請稍後重試或聯絡客服。');
      return;
    }

    const timeout = setTimeout(() => {
      setStatusText('若付款視窗未顯示，請確認瀏覽器未封鎖彈出視窗並重新整理。');
    }, 7000);

    return () => clearTimeout(timeout);
  }, [scriptReady, transactionId]);

  const initializePaddle = () => {
    if (!window.Paddle) {
      setStatusText('付款元件載入失敗，請重新整理頁面。');
      return;
    }

    if (window.Paddle.Environment?.set) {
      window.Paddle.Environment.set(PUBLIC_PADDLE_ENV);
    }

    if (PUBLIC_PADDLE_CLIENT_TOKEN && window.Paddle.Initialize) {
      window.Paddle.Initialize({
        token: PUBLIC_PADDLE_CLIENT_TOKEN,
        eventCallback: (event: any) => {
          const eventName = String(event?.name || '');
          if (!eventName) return;

          if (eventName.includes('checkout.completed')) {
            completedRef.current = true;
            setStatusText('付款成功，正在返回訂單完成頁...');
            safeRedirect(successUrl, '/');
            return;
          }

          if (eventName.includes('checkout.closed')) {
            if (completedRef.current) return;
            setStatusText('已關閉付款視窗，正在返回訂單頁...');
            safeRedirect(cancelUrl, '/');
          }
        },
      });
    }

    setScriptReady(true);
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

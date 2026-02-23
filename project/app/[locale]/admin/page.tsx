'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-gray-400">Redirecting...</div>
    </div>
  );
}

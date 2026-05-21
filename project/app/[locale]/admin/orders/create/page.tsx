'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Mic, Music, Disc3 } from 'lucide-react';
import VoiceForm from './forms/VoiceForm';
import MusicForm from './forms/MusicForm';
import OrchestraForm from './forms/OrchestraForm';

type OrderType = 'voice' | 'music' | 'orchestra';

const TABS: { value: OrderType; label: string; icon: typeof Mic; color: string }[] = [
  { value: 'voice', label: 'Voice', icon: Mic, color: 'amber' },
  { value: 'music', label: 'Music', icon: Music, color: 'purple' },
  { value: 'orchestra', label: 'Orchestra', icon: Disc3, color: 'rose' },
];

export default function CreateManualOrderPage() {
  const [activeTab, setActiveTab] = useState<OrderType>('voice');

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          New Manual Order
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Create an order on behalf of a client — supports offline payments (wire / Alipay / WeChat /
          Wise) to bypass Paddle's 5% fee on large B2B deals.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="mb-8 flex gap-2 border-b border-gray-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Form area */}
      {activeTab === 'voice' && <VoiceForm />}
      {activeTab === 'music' && <MusicForm />}
      {activeTab === 'orchestra' && <OrchestraForm />}
    </div>
  );
}

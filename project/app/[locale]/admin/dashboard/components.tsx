'use client';

import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MetricCardProps {
  title: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const MetricCard = ({ title, value, trend, trendValue, icon, color, bgColor, borderColor }: MetricCardProps) => (
  <Card className={`bg-[#0a0a0a] border ${borderColor}`}>
    <CardContent className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${bgColor}`}>
          {icon}
        </div>
        {trend === 'up' ? (
          <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
            <ArrowUpRight className="w-4 h-4" />
            {trendValue}
          </div>
        ) : trend === 'down' ? (
          <div className="flex items-center gap-1 text-red-400 text-xs font-medium">
            <ArrowDownRight className="w-4 h-4" />
            {trendValue}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-yellow-400 text-xs font-medium">
            <Minus className="w-4 h-4" />
            {trendValue}
          </div>
        )}
      </div>
      <div>
        <p className="text-gray-400 text-sm mb-1">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
      </div>
    </CardContent>
  </Card>
);

interface TrafficChartProps {
  data: Array<{
    day: string;
    orders: number;
    revenue?: number;
  }>;
}

export const TrafficChart = ({ data }: TrafficChartProps) => (
  <Card className="bg-[#0a0a0a] border-white/10">
    <CardHeader>
      <CardTitle className="text-white text-lg">Daily Orders (7 days)</CardTitle>
      <p className="text-gray-400 text-xs">Paid orders per day</p>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="day" stroke="#888" tick={{ fill: '#888' }} />
          <YAxis stroke="#888" tick={{ fill: '#888' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <Legend wrapperStyle={{ color: '#888' }} />
          <Line
            type="monotone"
            dataKey="orders"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

interface VoiceBarChartProps {
  data: Array<{
    voice: string;
    percentage: number;
    orders: number;
  }>;
}

export const VoiceBarChart = ({ data }: VoiceBarChartProps) => (
  <Card className="bg-[#0a0a0a] border-white/10">
    <CardHeader>
      <CardTitle className="text-white text-lg">Top Voices</CardTitle>
      <p className="text-gray-400 text-xs">Order distribution</p>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="voice" stroke="#888" tick={{ fill: '#888' }} />
          <YAxis stroke="#888" tick={{ fill: '#888' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <Bar dataKey="percentage" fill="#3b82f6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

interface AIInsightPanelProps {
  message: string;
  onReviewAudio?: () => void;
  onCreatePromo?: () => void;
}

export const AIInsightPanel = ({ message, onReviewAudio, onCreatePromo }: AIInsightPanelProps) => (
  <Card className="bg-gradient-to-br from-[#0a0a0a] to-blue-950/20 border-blue-500/20">
    <CardContent className="p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Bot className="w-8 h-8 text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-white">AI Analyst</h3>
            <span className="text-xs text-blue-400 font-medium px-2 py-0.5 rounded-full bg-blue-500/10">
              Auto-generated
            </span>
          </div>
          <p className="text-gray-300 leading-relaxed">
            {message}
          </p>
          <div className="mt-4 flex gap-3">
            <Button
              onClick={onReviewAudio}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Review Arthur Audio
            </Button>
            <Button
              onClick={onCreatePromo}
              variant="outline"
              className="bg-white/5 hover:bg-white/10 text-white border-white/10"
            >
              Create Promo
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

interface SectionHeaderProps {
  title: string;
}

export const SectionHeader = ({ title }: SectionHeaderProps) => (
  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
    <div className="w-1 h-6 bg-blue-500 rounded-full" />
    {title}
  </h2>
);

'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AI_TOOLS, TOOL_CATEGORIES, type ToolCategory, type AiTool, type ToolPricing } from '@/data/ai-tools';

interface ToolsGridProps {
  locale: string;
}

export default function ToolsGrid({ locale }: ToolsGridProps) {
  const [selected, setSelected] = useState<ToolCategory | 'all'>('all');

  const isZhCN = locale === 'zh-CN';
  const isZh   = locale.startsWith('zh');

  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const getDesc = (tool: AiTool) => tx(tool.description.tw, tool.description.cn, tool.description.en);
  const getCatLabel = (cat: (typeof TOOL_CATEGORIES)[0]) =>
    tx(cat.labelTw, cat.labelCn, cat.labelEn);

  const filtered =
    selected === 'all' ? AI_TOOLS : AI_TOOLS.filter((t) => t.category === selected);

  const pricingLabel = (p: ToolPricing) => {
    const map: Record<ToolPricing, { en: string; tw: string; cn: string }> = {
      free:     { en: 'Free',        tw: '免費',   cn: '免费'   },
      freemium: { en: 'Free Plan',   tw: '免費方案', cn: '免费方案' },
      paid:     { en: 'Paid',        tw: '付費',   cn: '付费'   },
    };
    return tx(map[p].tw, map[p].cn, map[p].en);
  };

  const pricingClass = (p: ToolPricing) => {
    if (p === 'free')     return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
    if (p === 'freemium') return 'bg-sky-500/15 text-sky-400 border-sky-500/25';
    return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25';
  };

  const tryLabel = tx('前往試用', '前往试用', 'Try it free');

  return (
    <>
      {/* ── Category filter ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-2 mb-12">
        {TOOL_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelected(cat.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              selected === cat.key
                ? 'bg-amber-400 text-black border-amber-400'
                : 'border-white/15 text-gray-400 hover:text-gray-200 hover:border-white/30 bg-transparent'
            }`}
          >
            {getCatLabel(cat)}
          </button>
        ))}
      </div>

      {/* ── Tools grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((tool) => (
          <div
            key={tool.id}
            className="group flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-amber-400/30 hover:bg-white/[0.05] transition-all duration-200"
          >
            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl leading-none">{tool.emoji}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${pricingClass(tool.pricing)}`}
              >
                {pricingLabel(tool.pricing)}
              </span>
            </div>

            {/* Name */}
            <h3 className="font-semibold text-white text-base mb-2">{tool.name}</h3>

            {/* Description */}
            <p className="text-gray-400 text-sm leading-relaxed flex-1 mb-4">
              {getDesc(tool)}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {tool.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-gray-500"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* CTA */}
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors group/link"
            >
              {tryLabel}
              <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-0.5" />
            </a>
          </div>
        ))}
      </div>

      {/* Tool count */}
      <p className="text-center text-gray-600 text-xs mt-8">
        {tx(
          `顯示 ${filtered.length} 個工具`,
          `显示 ${filtered.length} 个工具`,
          `Showing ${filtered.length} tool${filtered.length !== 1 ? 's' : ''}`,
        )}
      </p>
    </>
  );
}

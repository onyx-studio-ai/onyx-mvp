/**
 * Shared form primitives for the 4 partner-application routes:
 *   /apply/voice (existing) / /apply/studio / /apply/director / /apply/proofreader
 *
 * Identical pattern to the Section/Field/Choices helpers inlined in
 * /dubbing/brief and /data/brief — extracted here so the 3 new partner
 * forms (studio, director, proofreader) don't duplicate ~60 lines each.
 *
 * All variants use the amber accent baked-in (Partner Network is amber-
 * themed, matching the homepage data-card accent and /data brand).
 */

'use client';

import * as React from 'react';

export function Section({
  title,
  hint,
  required,
  children,
}: {
  title: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">
          {title}
          {required && <span className="text-amber-400 ml-1">*</span>}
        </h2>
        {hint && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2">
        {label}
        {required && <span className="text-amber-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-2 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

export function Choices({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: [string, string][];
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, label]) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onSelect(k)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              active ? 'bg-amber-500 text-black border-amber-500'
                     : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition ${
        active ? 'bg-amber-500 text-black border-amber-500'
               : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
      }`}
    >
      {label}
    </button>
  );
}

export function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
    />
  );
}

export function Textarea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
    />
  );
}

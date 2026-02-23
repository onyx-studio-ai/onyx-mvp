export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  TWD: 30.1,
  CNY: 7.2,
};

const LOCALE_CURRENCY_MAP: Record<string, string> = {
  en: "USD",
  "zh-TW": "TWD",
  "zh-CN": "CNY",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  TWD: "NT$",
  CNY: "¥",
};

export function getCurrencyCode(locale: string): string {
  return LOCALE_CURRENCY_MAP[locale] ?? "USD";
}

export function getCurrencySymbol(locale: string): string {
  const code = getCurrencyCode(locale);
  return CURRENCY_SYMBOLS[code] ?? "$";
}

export function formatPrice(amount: number, locale: string): string {
  const currencyCode = getCurrencyCode(locale);
  const rate = EXCHANGE_RATES[currencyCode] ?? 1;
  const converted = Math.round(amount * rate);

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(converted);
}

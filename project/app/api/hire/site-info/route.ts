import { NextRequest, NextResponse } from 'next/server';

/*
  POST /api/hire/site-info { url } → { name, description }
  客戶在 AI 發案給官網網址時,伺服器端抓取首頁擷取公司名稱(og:site_name / <title>)
  與簡介(og:description / meta description),自動帶入需求單(Wing 2026-08-06)。
  公開端點:只抓公開網頁、6 秒逾時、回應截斷;擋內網位址防 SSRF。
*/

const PRIVATE_HOST = /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.(local|internal)$/i;

function metaContent(html: string, key: string): string {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i'))?.[0] || '';
  return (tag.match(/content=["']([^"']+)["']/i)?.[1] || '').trim();
}

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  let raw = String(body.url || '').trim();
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }); }
  if (!/^https?:$/.test(u.protocol) || PRIVATE_HOST.test(u.hostname)) {
    return NextResponse.json({ error: 'Unsupported url' }, { status: 400 });
  }
  try {
    const res = await fetch(u.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OnyxAria/1.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const html = (await res.text()).slice(0, 200_000);
    const name = metaContent(html, 'og:site_name') || (html.match(/<title[^>]*>([^<]{1,160})/i)?.[1] || '').trim();
    const description = metaContent(html, 'og:description') || metaContent(html, 'description');
    return NextResponse.json({ name: name.slice(0, 120), description: description.slice(0, 500) });
  } catch {
    return NextResponse.json({ name: '', description: '' }); // 抓不到就靜默,不擋流程
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { discordConfigured } from '@/lib/discord';

/*
  Talent-side Discord binding(照 /api/talent/telegram 的模式)。
    GET    → { linked, botConfigured, link } — `link` 是 Discord OAuth 授權連結,
             state 帶一次性 token;使用者按「授權」後由 /api/discord/callback 完成綁定
             (identify 拿 user id + guilds.join 自動加入 Onyx 伺服器,bot 才能 DM)。
    DELETE → 解除綁定(清 discord_user_id)。
  (需 migration:talents.discord_user_id / discord_link_token)
*/

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, discord_user_id, discord_link_token');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string; discord_user_id?: string | null; discord_link_token?: string | null };
  if (!discordConfigured()) return NextResponse.json({ linked: false, botConfigured: false, link: null });
  let token = t.discord_link_token || '';
  if (!token) {
    token = randomUUID().replace(/-/g, '');
    const { error } = await r.db.from('talents').update({ discord_link_token: token }).eq('id', t.id);
    if (error) return NextResponse.json({ linked: false, botConfigured: false, link: null }); // 欄位未 migration → 休眠
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai').replace(/\/$/, '');
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || '',
    response_type: 'code',
    scope: 'identify guilds.join',
    redirect_uri: `${site}/api/discord/callback`,
    state: token,
    prompt: 'none',
  });
  return NextResponse.json({
    linked: !!t.discord_user_id,
    botConfigured: true,
    link: `https://discord.com/oauth2/authorize?${params.toString()}`,
  });
}

export async function DELETE(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string };
  await r.db.from('talents').update({ discord_user_id: null }).eq('id', t.id);
  return NextResponse.json({ ok: true });
}

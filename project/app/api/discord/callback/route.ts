import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendDiscord } from '@/lib/discord';

/*
  Discord OAuth callback:配音員在 Discord 按「授權」後回到這裡。
  流程:code 換 access_token → /users/@me 拿 user id → 用 state(一次性 token)
  對回 talents.discord_link_token 找到本人 → 存 discord_user_id、清 token →
  guilds.join 自動把他加進 Onyx 伺服器(bot 與使用者共享伺服器才能 DM)→
  DM 一則「綁定成功」→ 轉回 /talent。
  任何一步失敗都轉回 /talent?discord=error,不會卡在白畫面。
*/

const API = 'https://discord.com/api/v10';

export async function GET(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai').replace(/\/$/, '');
  const fail = () => NextResponse.redirect(`${site}/zh-TW/talent?discord=error`);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code') || '';
  const state = searchParams.get('state') || '';
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!code || !state || !clientId || !clientSecret) return fail();

  try {
    // state 一定要先對得到人,才去換 token(防止拿任意 code 亂綁)
    const db = getSupabaseServiceClient();
    const { data: t } = await db.from('talents').select('id, name').eq('discord_link_token', state).maybeSingle();
    if (!t) return fail();

    const tokenRes = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${site}/api/discord/callback`,
      }),
    });
    if (!tokenRes.ok) return fail();
    const { access_token: accessToken } = await tokenRes.json();

    const meRes = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!meRes.ok) return fail();
    const me = await meRes.json();
    const userId = String(me.id || '');
    if (!userId) return fail();

    // 自動加入 Onyx 伺服器(已在裡面會回 204,同樣算成功)
    const guildId = process.env.DISCORD_GUILD_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (guildId && botToken) {
      await fetch(`${API}/guilds/${guildId}/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bot ${botToken}` },
        body: JSON.stringify({ access_token: accessToken }),
      }).catch(() => {});
    }

    await db.from('talents').update({ discord_user_id: userId, discord_link_token: null }).eq('id', t.id);
    await sendDiscord(userId, `✅ 綁定成功!${t.name ? `${t.name},` : ''}之後 Onyx 的案件通知(開錄、訊息、修改需求、交件提醒)都會即時推送到這裡。回覆案件請到平台後台:${site}/talent/opportunities`);
    return NextResponse.redirect(`${site}/zh-TW/talent?discord=linked`);
  } catch {
    return fail();
  }
}

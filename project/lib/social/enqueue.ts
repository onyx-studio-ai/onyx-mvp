import type { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  內容自動入列 —— 產生社群貼文文案並寫進 social_queue,由 /api/cron/social-post 定時發。

  本次 MVP 只做「招募貼文」(kind='casting'):後台一發案就自動排一則 FB 招募文。

  TODO(之後接):
    • kind='blog'      —— onyx-blog-writer 排程每週二/五產出文章後,順手呼叫
                          enqueueBlogPost({ slug, title, excerpt, coverUrl }):
                          source_id = blog slug(防同一篇重複入列),
                          media_url = 文章 cover(已是 onyxstudios.ai 上的公開 URL)
                          → 自動滿足 IG「必須有媒體」的限制,platforms 可直接給 ['fb','ig','x']。
    • kind='evergreen' —— 常青行銷貼文(服務介紹、配音員招募通則、案例)。
                          由排程任務定期批次生成 N 則 status='ready' + 錯開 scheduled_for,
                          cron 每天發一則,把粉專餵飽。source_id 用「主題代號」防重複。
  兩者都只要寫進同一張 social_queue,發送端完全不用改。
*/

type Db = ReturnType<typeof getSupabaseServiceClient>;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';
const ZH_RE = /中文|國語|国语|普通话|普通話|台語|台语|粵|粤|cantonese|mandarin|chinese/i;

export type CastingBriefForPost = {
  id: string;
  title: string;
  language?: string | null;
  rate_note?: string | null;
  audition_deadline?: string | null;
  content_type?: string | null;
  /** 有圖才會一起發 IG(IG 強制要媒體);目前發案流程沒有圖,先留著 */
  media_url?: string | null;
};

/** 產生招募貼文文案 —— 案件語言是中文走繁中,其餘走英文 */
export function castingPostContent(brief: CastingBriefForPost): { text: string; link: string } {
  const isZh = ZH_RE.test(brief.language || '');
  // 中文案 → 中文站台連結;其餘 → 英文(預設 locale 無前綴)
  const link = `${SITE}/${isZh ? 'zh-TW/' : ''}casting/join/${brief.id}`;

  const lines: string[] = [];
  if (isZh) {
    lines.push(`【配音試音案】${brief.title}${brief.content_type ? `(${brief.content_type})` : ''}`, '');
    if (brief.language) lines.push(`語言:${brief.language}`);
    if (brief.rate_note) lines.push(`報酬:${brief.rate_note}`);
    if (brief.audition_deadline) lines.push(`試音截止:${brief.audition_deadline}`);
    lines.push(
      '',
      'Onyx Studios 正在為此案徵求配音員。點下方連結報名試音,通過審核後即可看到完整案件說明與試音稿。',
      '',
      link,
      '',
      '#配音 #配音員 #試音 #聲音演出 #OnyxStudios',
    );
  } else {
    lines.push(`[Casting Call] ${brief.title}${brief.content_type ? ` — ${brief.content_type}` : ''}`, '');
    if (brief.language) lines.push(`Language: ${brief.language}`);
    if (brief.rate_note) lines.push(`Rate: ${brief.rate_note}`);
    if (brief.audition_deadline) lines.push(`Audition deadline: ${brief.audition_deadline}`);
    lines.push(
      '',
      'Onyx Studios is casting voice talent for this project. Tap the link to apply — approved talent get the full brief and the audition script.',
      '',
      link,
      '',
      '#voiceover #castingcall #voiceacting #voiceartist #OnyxStudios',
    );
  }
  return { text: lines.join('\n'), link };
}

/**
 * 把一張發案單排進社群佇列(kind='casting')。
 * 防重複靠 social_queue 的 unique (kind, source_id) —— 同一張單重發/重存都只會有一列。
 * 回傳 'queued' | 'duplicate' | 'error';呼叫端一律 try/catch 包住,失敗不影響發案主流程。
 */
export async function enqueueCastingPost(db: Db, brief: CastingBriefForPost): Promise<'queued' | 'duplicate' | 'error'> {
  const { text, link } = castingPostContent(brief);
  const mediaUrl = String(brief.media_url || '').trim();
  // IG 強制要媒體:沒圖就只發 FB,有圖才加 IG
  const platforms = mediaUrl ? ['fb', 'ig'] : ['fb'];

  const { error } = await db.from('social_queue').insert({
    kind: 'casting',
    platforms,
    text,
    link,
    media_url: mediaUrl || null,
    media_kind: mediaUrl ? 'image' : null,
    status: 'ready',
    source_id: brief.id,
  });
  if (!error) return 'queued';
  if (error.code === '23505') return 'duplicate'; // unique (kind, source_id) —— 已排過,正常
  console.error('[social] enqueueCastingPost 寫入失敗:', error.message);
  return 'error';
}

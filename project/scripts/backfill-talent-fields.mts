/*
  回填:把申請單填過、但沒搬進 talents 的結構化欄位補回去(2026-08-17 bug 修復)。
  只補「帳號目前是空」的欄位,絕不覆蓋配音員自己後來編輯過的內容。
  用法:npx tsx --env-file=.env scripts/backfill-talent-fields.mts [--apply]
*/
import { createClient } from '@supabase/supabase-js';
import { talentFieldsFromApplication } from '../lib/application-to-talent';

const APPLY = process.argv.includes('--apply');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: apps } = await db.from('talent_applications').select('*').eq('status', 'approved');
const { data: ts } = await db.from('talents').select('id, name, email, application_id, voice_traits, specialties, voice_ages, equipment, headshot_url, demos, demo_urls, is_active, published_snapshot');
const talentById = new Map((ts || []).map((t) => [String(t.id), t]));
const talentByEmail = new Map((ts || []).map((t) => [String(t.email || '').toLowerCase(), t]));

const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
let touched = 0;
const missing: string[] = [];

for (const a of apps || []) {
  const t = (a.talent_id && talentById.get(String(a.talent_id))) || talentByEmail.get(String(a.email || '').toLowerCase());
  if (!t) continue;
  const fields = talentFieldsFromApplication(a);
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (isEmpty((t as Record<string, unknown>)[k])) updates[k] = v;   // 只補空的
  }
  if (Object.keys(updates).length) {
    touched++;
    console.log(`${APPLY ? '補' : '待補'} ${t.name} <${t.email}>: ${Object.entries(updates).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : v}`).join(' | ')}`);
    if (APPLY) {
      const { error } = await db.from('talents').update(updates).eq('id', t.id);
      if (error) console.log(`   ✗ ${error.message}`);
    }
  }
  // 上架缺件清單
  const lacks: string[] = [];
  if (!t.headshot_url) lacks.push('頭像');
  if (!((t.demos || []).length)) lacks.push('分類demo');
  if (!t.is_active) lacks.push('未上架');
  if (lacks.length) missing.push(`${t.name} <${t.email}>: 缺 ${lacks.join('、')}`);
}
console.log(`\n${APPLY ? '已補' : '可補'} ${touched} 位`);
console.log(`\n=== 上架缺件清單(${missing.length} 位)===`);
missing.forEach((m) => console.log('  ' + m));

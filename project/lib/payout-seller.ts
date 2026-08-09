import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptJson, payoutEncConfigured } from './payout-crypto';

/*
  發票「賣方」(配音員)資訊 ← 解密收款資料。
  原本內嵌在 /api/talent/invoice,一鍵開立(use_signature)也要用 → 抽共用。
  收款資料是兩組結構 {twd,usd,tax}:姓名取台幣戶名,沒有再取美金戶名;地址/稅籍取稅務區。
  解不開/沒設定 → 全空字串,呼叫端 fallback 用 talents.name。
*/
export async function sellerFromPayoutDetails(db: SupabaseClient, talentId: string): Promise<{ sellerName: string; sellerAddress: string; sellerTaxId: string }> {
  let sellerName = '', sellerAddress = '', sellerTaxId = '';
  if (payoutEncConfigured()) {
    const { data: pd } = await db.from('talent_payout_details').select('enc_payload').eq('talent_id', talentId).maybeSingle();
    if (pd?.enc_payload) {
      try {
        const d = decryptJson<Record<string, unknown>>(pd.enc_payload as string);
        const twd = (d.twd && typeof d.twd === 'object' ? d.twd : {}) as Record<string, string>;
        const usd = (d.usd && typeof d.usd === 'object' ? d.usd : {}) as Record<string, string>;
        const tax = (d.tax && typeof d.tax === 'object' ? d.tax : {}) as Record<string, string>;
        sellerName = twd.account_holder || usd.account_holder || '';
        sellerAddress = tax.tax_address || '';
        // 稅籍編號:優先用自填的;台灣人沒填就自動帶身分證(national_id),海外只用自填的。
        sellerTaxId = tax.tax_id || (tax.tax_location === 'TW' ? tax.national_id : '') || '';
      } catch { /* 解不開就留空 */ }
    }
  }
  return { sellerName, sellerAddress, sellerTaxId };
}

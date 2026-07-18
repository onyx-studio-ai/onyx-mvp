import 'server-only';

/*
  AI 標示合規(EU AI Act Art 50(2),2026-08-02 生效)—— C2PA metadata 層。
  所有 AI 生成的「正式交付音檔」在共同出口(engine 的 uploadDeliverable)自動嵌入
  機器可讀 manifest:digitalSourceType = trainedAlgorithmicMedia,簽署者 Onyx Studios。
  Wing 2026-07-18 拍板:只蓋正式交付物(preview 不蓋);只做 EU 層(中國可聞提示層封存)。
  環境變數沒設 = 安靜跳過(dormant);簽署失敗 = 回原檔+log,絕不擋交付。
  憑證:自家迷你 CA(工程部/安全憑證/c2pa/),日後可換正式 CA。
  浮水印層(AudioSeal)為 fast-follow,另案。
*/

/** 修復被貼進單行輸入框而失去換行的 PEM(Vercel env 常見):
 *  支援三種毀損:字面 \n、CRLF、完全單行(BEGIN/END 黏在 base64 上)。 */
export function normalizePem(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let s = raw.replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  if (s.includes('\n')) return s;
  // 單行:把每個 -----BEGIN X-----base64-----END X----- 拆回多行、base64 每 64 字換行
  const blocks = [...s.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END \1-----/g)];
  if (!blocks.length) return s;
  return blocks.map(([, label, body]) => {
    const b64 = body.replace(/\s+/g, '');
    const wrapped = b64.match(/.{1,64}/g)?.join('\n') || b64;
    return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----`;
  }).join('\n');
}

export async function markAiAudio(buf: Buffer, mimeType = 'audio/mpeg'): Promise<Buffer> {
  const certPem = normalizePem(process.env.C2PA_CERT_PEM);
  const keyPem = normalizePem(process.env.C2PA_KEY_PEM);
  if (!certPem || !keyPem) return buf;   // 金鑰未設 → 原樣通過(先上程式後補 env 不會壞)
  try {
    // 動態載入:原生模組很重,只在真的要簽時才載
    const { Builder, LocalSigner } = await import('@contentauth/c2pa-node');
    const signer = LocalSigner.newSigner(Buffer.from(certPem), Buffer.from(keyPem), 'es256');
    const builder = Builder.withJson({
      claim_generator_info: [{ name: 'Onyx Studios AI Voice', version: '1.0' }],
      title: 'AI-generated audio (Onyx Studios)',
    });
    builder.setIntent({ create: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' });
    const out: { buffer: Buffer | null; mimeType: string } = { buffer: null, mimeType };
    builder.sign(signer, { buffer: buf, mimeType }, out);
    return out.buffer && out.buffer.length > 0 ? out.buffer : buf;
  } catch (err) {
    console.error('[c2pa] 標記失敗,交付原檔:', err instanceof Error ? err.message : err);
    return buf;   // 合規標記 best-effort,絕不因它擋住客戶交付
  }
}

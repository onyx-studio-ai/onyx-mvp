/*
  talents 加「也是客戶」標記 —— admin 可指定某配音員帳號同時能進客戶後台(/dashboard),
  不靠假訂單、不誤放外人(只有標記 true 的才算客戶)。
  isClient 判斷(app/api/talent/me/route.ts)已加「(0) admin 標記」讀這個欄位。
  Wing 2026-07-06 選方案 A;先把 wingywen@gmail.com(WING 本人配音員帳號)標成雙重身分。
*/
ALTER TABLE talents ADD COLUMN IF NOT EXISTS is_also_client boolean NOT NULL DEFAULT false;

UPDATE talents SET is_also_client = true WHERE email = 'wingywen@gmail.com';

NOTIFY pgrst, 'reload schema';

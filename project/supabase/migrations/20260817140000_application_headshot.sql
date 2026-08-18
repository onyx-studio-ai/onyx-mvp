/*
  申請表補收大頭照(2026-08-17)。
  先前申請表沒有頭像欄位 → 每位核准的配音員都得事後回頭補,51 位卡在未上架。
  存 talent-submissions 桶的路徑(與 demo 同桶,headshots/ 資料夾);核准建帳號時
  轉成 talents.headshot_url。程式端 photoUrl 缺這欄也不會壞(insert 帶 null)。
*/
alter table talent_applications add column if not exists headshot_url text;

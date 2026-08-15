/*
  配音員通知新管道:Discord 綁定 + 網頁推播(Web Push)。
  - discord_user_id:OAuth 綁定後存 Discord 使用者 id(bot 用它發 DM)
  - discord_link_token:一次性綁定 token(OAuth state),綁定成功即清空
  - push_subscriptions:Web Push 訂閱(jsonb 陣列,多裝置,每人上限 5 由 API 控)
  程式端全休眠設計:欄位不存在時所有讀寫靜默跳過,先部署後補跑此檔也安全。
*/
alter table talents add column if not exists discord_user_id text;
alter table talents add column if not exists discord_link_token text;
alter table talents add column if not exists push_subscriptions jsonb not null default '[]'::jsonb;

create index if not exists talents_discord_link_token_idx on talents (discord_link_token) where discord_link_token is not null;

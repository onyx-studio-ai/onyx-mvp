-- 配音員「網站 / 作品集連結」—— 只給內部(admin + 配音員自己編輯)看。
-- 🚫 絕不進 published_snapshot / roster / favorites,不給客戶看到(見 publish/route SNAPSHOT_COLS)。
alter table talents add column if not exists portfolio_url text;

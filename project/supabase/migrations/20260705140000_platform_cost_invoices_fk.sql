-- 補上 platform_cost_invoices.cost_id → platform_costs.id 的外鍵。
--
-- 為什麼:GET /api/admin/costs/invoices 與 zip route 都用 PostgREST 內嵌
--   .select('*, platform_costs:cost_id(name)')
-- 來 join 工具名。PostgREST 需要「兩表之間有外鍵關係」才能解析內嵌,否則
-- 整個查詢回錯(找不到關聯),前端 `if (ir.ok)` 為 false → invoices 永遠是空陣列,
-- 導致「本月發票已上傳」badge 不會亮、已上傳清單看不到。原始 migration
-- (20260703190000)只留註解「對應 platform_costs.id」但沒建外鍵,這裡補上。
--
-- 順帶加 on delete cascade:刪工具時發票紀錄自動清掉(與後台刪除提示一致)。
-- 先清掉任何指向不存在工具的孤兒列,避免加外鍵時失敗。

delete from public.platform_cost_invoices i
where not exists (
  select 1 from public.platform_costs c where c.id = i.cost_id
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'platform_cost_invoices_cost_id_fkey'
  ) then
    alter table public.platform_cost_invoices
      add constraint platform_cost_invoices_cost_id_fkey
      foreign key (cost_id) references public.platform_costs (id) on delete cascade;
  end if;
end $$;

-- 查本月發票、依工具過濾都會用到 cost_id,補個索引。
create index if not exists idx_platform_cost_invoices_cost_id
  on public.platform_cost_invoices (cost_id);
create index if not exists idx_platform_cost_invoices_period
  on public.platform_cost_invoices (period);

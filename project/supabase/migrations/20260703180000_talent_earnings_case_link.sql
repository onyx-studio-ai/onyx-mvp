-- talent_earnings 綁回案子(quote / brief),供「請款綁案子、發票帶案名」(③)使用。
-- 真人接案客戶驗收通過時,review API 會帶這兩個 id 進來(見 client/orders/[id]/review)。
alter table talent_earnings add column if not exists quote_id uuid;
alter table talent_earnings add column if not exists brief_id uuid;

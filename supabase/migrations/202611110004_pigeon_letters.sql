-- Güvercinli mektuplar için teslim zamanı ve mesafe metadatası.
create or replace function private.validate_shared_record() returns trigger
language plpgsql set search_path = '' as $$
declare key_name text; parsed_date date;
begin
  if jsonb_typeof(new.data) <> 'object' then raise exception 'Kayıt verisi bir nesne olmalıdır.' using errcode = '22023'; end if;
  for key_name in select jsonb_object_keys(new.data) loop
    if key_name not in ('title','body','date','time','location','done','items','url','mood','specialDayType','price','deliveryAt','distanceKm') then
      raise exception 'Desteklenmeyen kayıt alanı: %', key_name using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(new.data -> 'title') is distinct from 'string' or char_length(btrim(new.data ->> 'title')) not between 1 and 200 then
    raise exception 'Başlık 1–200 karakter olmalıdır.' using errcode = '22023';
  end if;
  if new.data ? 'body' and jsonb_typeof(new.data -> 'body') <> 'string' then raise exception 'Gövde metin olmalıdır.' using errcode = '22023'; end if;
  if char_length(coalesce(new.data ->> 'body','')) > (case when new.category = 'partner-note' then 140 when new.category = 'mood' then 280 else 10000 end) then raise exception 'Not izin verilen uzunluğu aşıyor.' using errcode = '22023'; end if;
  if new.data ? 'date' then
    if jsonb_typeof(new.data -> 'date') <> 'string' or (new.data ->> 'date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Tarih YYYY-MM-DD biçiminde olmalıdır.' using errcode = '22023'; end if;
    parsed_date := (new.data ->> 'date')::date;
  elsif new.category in ('calendar','special-days','mood','song','steps') then raise exception 'Bu kayıt için tarih gereklidir.' using errcode = '22023'; end if;
  if new.data ? 'time' and (jsonb_typeof(new.data -> 'time') <> 'string' or (new.data ->> 'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Saat SS:DD biçiminde olmalıdır.' using errcode = '22023'; end if;
  if new.data ? 'deliveryAt' and (jsonb_typeof(new.data -> 'deliveryAt') <> 'string' or (new.data ->> 'deliveryAt')::timestamptz is null) then raise exception 'Teslim zamanı geçersiz.' using errcode = '22023'; end if;
  if new.data ? 'distanceKm' and (jsonb_typeof(new.data -> 'distanceKm') <> 'number' or (new.data ->> 'distanceKm')::numeric < 0) then raise exception 'Mesafe geçersiz.' using errcode = '22023'; end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.couple_id <> old.couple_id or new.created_by <> old.created_by or new.category <> old.category or new.created_at <> old.created_at then raise exception 'Kayıt kimliği ve oluşturan bilgisi değiştirilemez.' using errcode = '22023'; end if;
    new.version := old.version + 1; new.updated_at := now();
  else new.version := 1; new.created_at := now(); new.updated_at := now(); end if;
  return new;
end;
$$;

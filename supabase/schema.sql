-- İkimiz core schema. Apply once to a new Supabase project, in a transaction.
begin;

create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  relationship_date date,
  plant_kind text not null default 'heart' check (plant_kind in ('heart','violet','cactus')),
  watered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (relationship_date is null or relationship_date <= current_date)
);

-- Only active memberships are stored here. A user cannot be in two couples.
create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  couple_id uuid references public.couples(id),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  check (accepted_by is null or accepted_by <> inviter_id),
  check ((status = 'accepted') = (couple_id is not null))
);
create unique index invitations_one_pending_per_user on public.invitations(inviter_id) where status = 'pending';

create table public.shared_records (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  category text not null check (category in ('calendar','special-days','lists','notebook','documents','gallery','voice','tasks','partner-note','song','gifts','info','places','steps','mood')),
  data jsonb not null,
  -- Attribution is immutable, but is deliberately NOT an ownership permission.
  -- Keep the UUID after account removal so shared content is not cascade-deleted.
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create index shared_records_couple_updated on public.shared_records(couple_id, updated_at desc);
create unique index shared_records_daily_author on public.shared_records(couple_id, category, created_by, (data ->> 'date'))
  where category in ('mood','song','steps');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 1000),
  category text,
  kind text not null default 'activity' check (kind in ('activity','kiss','pairing')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_recipient_created on public.notifications(recipient_id, created_at desc);

create function private.current_user_id() returns uuid
language plpgsql stable set search_path = '' as $$
declare user_id uuid := auth.uid();
begin
  if user_id is null then raise exception 'Oturum açmanız gerekiyor.' using errcode = '28000'; end if;
  return user_id;
end;
$$;

create function private.is_couple_member(target_couple uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.couple_members m join public.couples c on c.id = m.couple_id
    where m.couple_id = target_couple and m.user_id = auth.uid() and c.ended_at is null
  );
$$;

create function private.can_read_profile(target_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select target_user = auth.uid() or exists (
    select 1 from public.couple_members me
    join public.couple_members partner on partner.couple_id = me.couple_id
    join public.couples c on c.id = me.couple_id
    where me.user_id = auth.uid() and partner.user_id = target_user and c.ended_at is null
  );
$$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger couples_touch before update on public.couples for each row execute function private.touch_updated_at();

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, display_name) values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''), 80)
  );
  return new;
end;
$$;
create trigger ikimiz_on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

create function private.validate_shared_record() returns trigger
language plpgsql set search_path = '' as $$
declare item jsonb; key_name text; parsed_date date;
begin
  if jsonb_typeof(new.data) <> 'object' then raise exception 'Kayıt verisi bir nesne olmalıdır.' using errcode = '22023'; end if;
  for key_name in select jsonb_object_keys(new.data) loop
    if key_name not in ('title','body','date','time','location','done','items','url','mood','specialDayType','price') then
      raise exception 'Desteklenmeyen kayıt alanı: %', key_name using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(new.data -> 'title') is distinct from 'string'
     or char_length(btrim(new.data ->> 'title')) not between 1 and 200 then
    raise exception 'Başlık 1–200 karakter olmalıdır.' using errcode = '22023';
  end if;
  foreach key_name in array array['body','location','url','mood','specialDayType','price'] loop
    if new.data ? key_name and jsonb_typeof(new.data -> key_name) <> 'string' then
      raise exception '% metin olmalıdır.', key_name using errcode = '22023';
    end if;
  end loop;
  if char_length(coalesce(new.data ->> 'body','')) > (case when new.category = 'partner-note' then 140 when new.category = 'mood' then 280 else 10000 end) then
    raise exception 'Not izin verilen uzunluğu aşıyor.' using errcode = '22023';
  end if;
  if char_length(coalesce(new.data ->> 'location','')) > 500 or char_length(coalesce(new.data ->> 'price','')) > 100 then
    raise exception 'Alan izin verilen uzunluğu aşıyor.' using errcode = '22023';
  end if;
  if new.data ? 'date' then
    if jsonb_typeof(new.data -> 'date') <> 'string' or (new.data ->> 'date') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Tarih YYYY-MM-DD biçiminde olmalıdır.' using errcode = '22023';
    end if;
    parsed_date := (new.data ->> 'date')::date;
    if parsed_date < date '1900-01-01' or parsed_date > date '2200-12-31' then
      raise exception 'Tarih desteklenen aralıkta değil.' using errcode = '22023';
    end if;
  elsif new.category in ('calendar','special-days','mood','song','steps') then
    raise exception 'Bu kayıt için tarih gereklidir.' using errcode = '22023';
  end if;
  if new.data ? 'time' and (jsonb_typeof(new.data -> 'time') <> 'string' or (new.data ->> 'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
    raise exception 'Saat SS:DD biçiminde olmalıdır.' using errcode = '22023';
  end if;
  if new.data ? 'done' and jsonb_typeof(new.data -> 'done') <> 'boolean' then
    raise exception 'Tamamlanma alanı doğru/yanlış olmalıdır.' using errcode = '22023';
  end if;
  if new.data ? 'url' and ((new.data ->> 'url') !~ '^https?://[^/[:space:]]+' or (new.data ->> 'url') ~ '[[:space:]]' or char_length(new.data ->> 'url') > 2048) then
    raise exception 'Geçerli bir http veya https bağlantısı girin.' using errcode = '22023';
  end if;
  if new.data ? 'specialDayType' and (new.data ->> 'specialDayType') not in ('birthday','anniversary','other') then
    raise exception 'Özel gün türü geçersiz.' using errcode = '22023';
  end if;
  if new.category = 'mood' and coalesce(new.data ->> 'mood','') not in ('🤩','😊','😐','😔','😣','😴','💪','😡','😒','Harika','İyi','İdare eder','Keyifsiz','Zorlanıyorum','Yorgunum','Enerjik','Kızgın','Sıkılmış') then
    raise exception 'Geçerli bir ruh hali seçin.' using errcode = '22023';
  end if;
  if new.data ? 'items' then
    if jsonb_typeof(new.data -> 'items') <> 'array' or jsonb_array_length(new.data -> 'items') > 200 then
      raise exception 'Listede en fazla 200 madde olabilir.' using errcode = '22023';
    end if;
    for item in select value from jsonb_array_elements(new.data -> 'items') loop
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'id') is distinct from 'string'
         or char_length(item ->> 'id') not between 1 and 100 or jsonb_typeof(item -> 'text') is distinct from 'string'
         or char_length(btrim(item ->> 'text')) not between 1 and 500 or jsonb_typeof(item -> 'done') is distinct from 'boolean'
         or exists (select 1 from jsonb_object_keys(item) as keys(name) where keys.name not in ('id','text','done')) then
        raise exception 'Liste maddesi geçersiz.' using errcode = '22023';
      end if;
    end loop;
    if (select count(*) <> count(distinct value ->> 'id') from jsonb_array_elements(new.data -> 'items')) then
      raise exception 'Liste maddelerinin kimlikleri farklı olmalıdır.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.couple_id <> old.couple_id or new.created_by <> old.created_by or new.category <> old.category or new.created_at <> old.created_at then
      raise exception 'Kayıt kimliği ve oluşturan bilgisi değiştirilemez.' using errcode = '22023';
    end if;
    new.version := old.version + 1;
    new.updated_at := now();
  else
    new.version := 1; new.created_at := now(); new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger shared_records_validate before insert or update on public.shared_records for each row execute function private.validate_shared_record();

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.invitations enable row level security;
alter table public.shared_records enable row level security;
alter table public.notifications enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (private.can_read_profile(id));
create policy profiles_edit_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy couples_read on public.couples for select to authenticated using (private.is_couple_member(id));
create policy couples_edit on public.couples for update to authenticated using (private.is_couple_member(id)) with check (private.is_couple_member(id));
create policy members_read on public.couple_members for select to authenticated using (user_id = auth.uid() or private.is_couple_member(couple_id));
create policy invitations_read on public.invitations for select to authenticated using (inviter_id = auth.uid() or accepted_by = auth.uid());
create policy records_read on public.shared_records for select to authenticated using (private.is_couple_member(couple_id));
create policy records_insert on public.shared_records for insert to authenticated with check (private.is_couple_member(couple_id) and created_by = auth.uid());
-- These policies describe equal membership permissions; writes also require the
-- version-checking RPCs because direct UPDATE/DELETE grants are intentionally absent.
create policy records_update on public.shared_records for update to authenticated using (private.is_couple_member(couple_id)) with check (private.is_couple_member(couple_id));
create policy records_delete on public.shared_records for delete to authenticated using (private.is_couple_member(couple_id));
create policy notifications_read on public.notifications for select to authenticated using (recipient_id = auth.uid() and (couple_id is null or private.is_couple_member(couple_id)));
create policy notifications_mark_read on public.notifications for update to authenticated using (recipient_id = auth.uid() and (couple_id is null or private.is_couple_member(couple_id))) with check (recipient_id = auth.uid());

revoke all on public.profiles, public.couples, public.couple_members, public.invitations, public.shared_records, public.notifications from public, anon, authenticated;
grant select on public.profiles, public.couples, public.couple_members, public.invitations, public.shared_records, public.notifications to authenticated;
grant update(full_name,display_name) on public.profiles to authenticated;
grant update(relationship_date,plant_kind,watered_at) on public.couples to authenticated;
grant insert(id,couple_id,category,data,created_by) on public.shared_records to authenticated;
grant update(read) on public.notifications to authenticated;

create function public.create_invitation() returns public.invitations
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); result public.invitations; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; bytes bytea; new_code text; attempt integer; i integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text, 74219));
  if exists (select 1 from public.couple_members where couple_members.user_id = actor_id) then
    raise exception 'Zaten bir partnerle eşleşmişsiniz.' using errcode = '23505';
  end if;
  update public.invitations set status = 'cancelled' where inviter_id = actor_id and status = 'pending';
  for attempt in 1..10 loop
    bytes := extensions.gen_random_bytes(6); new_code := '';
    for i in 0..5 loop new_code := new_code || substr(alphabet, get_byte(bytes,i) % 32 + 1, 1); end loop;
    begin
      insert into public.invitations(code, inviter_id) values(new_code,actor_id) returning * into result;
      return result;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception 'Davet kodu oluşturulamadı. Tekrar deneyin.';
end;
$$;

create function public.accept_invitation(invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); invite public.invitations; inviter uuid; new_couple uuid;
begin
  select inviter_id into inviter from public.invitations where code = upper(btrim(invite_code));
  if inviter is null or inviter = actor_id then raise exception 'Davet kodu geçersiz.' using errcode = '22023'; end if;
  -- All pairing operations lock user IDs in one order, before invitation rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(actor_id::text,inviter::text),74219));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(greatest(actor_id::text,inviter::text),74219));
  select * into invite from public.invitations where code = upper(btrim(invite_code)) for update;
  if invite.id is null or invite.status <> 'pending' or invite.expires_at <= now() then raise exception 'Bu davet artık geçerli değil.' using errcode = '22023'; end if;
  if exists (select 1 from public.couple_members where couple_members.user_id in (actor_id,inviter)) then
    raise exception 'Partnerlerden biri zaten eşleşmiş.' using errcode = '23505';
  end if;
  insert into public.couples default values returning id into new_couple;
  insert into public.couple_members(couple_id,user_id) values(new_couple,actor_id),(new_couple,inviter);
  update public.invitations set status='accepted', accepted_by=actor_id, couple_id=new_couple where id=invite.id;
  update public.invitations set status='cancelled' where inviter_id in (actor_id,inviter) and status='pending';
  insert into public.notifications(recipient_id,couple_id,title,body,kind) values
    (inviter,new_couple,'Artık İkimiz!','Partnerin davetini kabul etti. Ortak alanınız hazır.','pairing'),
    (actor_id,new_couple,'Ortak yuvanıza hoş geldiniz','Birlikte güzel şeyler biriktirmeye başlayın.','pairing');
  return new_couple;
end;
$$;

create function public.cancel_invitation(invitation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text,74219));
  update public.invitations set status='cancelled' where id=invitation_id and inviter_id=actor_id and status='pending';
  if not found then raise exception 'İptal edilebilir davet bulunamadı.' using errcode = '22023'; end if;
end;
$$;

create function public.reject_invitation(invite_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); inviter uuid;
begin
  select inviter_id into inviter from public.invitations where code=upper(btrim(invite_code));
  if inviter is null or inviter=actor_id then raise exception 'Davet kodu geçersiz.' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(inviter::text,74219));
  update public.invitations set status='rejected' where code=upper(btrim(invite_code)) and status='pending' and expires_at>now();
  if not found then raise exception 'Bu davet artık geçerli değil.' using errcode='22023'; end if;
end;
$$;

create function public.leave_couple() returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); current_couple uuid; partner uuid;
begin
  select couple_id into current_couple from public.couple_members where couple_members.user_id=actor_id;
  if current_couple is null then raise exception 'Etkin bir eşleşme bulunamadı.' using errcode='22023'; end if;
  select couple_members.user_id into partner from public.couple_members where couple_id=current_couple and couple_members.user_id<>actor_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(actor_id::text,coalesce(partner,actor_id)::text),74219));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(greatest(actor_id::text,coalesce(partner,actor_id)::text),74219));
  perform 1 from public.couples where id=current_couple for update;
  if not private.is_couple_member(current_couple) then raise exception 'Eşleşme zaten sonlandırılmış.' using errcode='22023'; end if;
  update public.couples set ended_at=now() where id=current_couple;
  delete from public.couple_members where couple_id=current_couple;
end;
$$;

create function public.update_shared_record(record_id uuid, expected_version integer, record_data jsonb) returns public.shared_records
language plpgsql security definer set search_path = '' as $$
declare existing public.shared_records; result public.shared_records;
begin
  perform private.current_user_id();
  select * into existing from public.shared_records where id=record_id for update;
  if existing.id is null or not private.is_couple_member(existing.couple_id) then raise exception 'Kayıt bulunamadı veya erişim izniniz yok.' using errcode='42501'; end if;
  if expected_version is null or expected_version < 1 or existing.version <> expected_version then raise exception 'Bu kayıt değişti. Yenileyip tekrar deneyin.' using errcode='40001'; end if;
  update public.shared_records set data=record_data where id=record_id returning * into result;
  return result;
end;
$$;

create function public.delete_shared_record(record_id uuid, expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare existing public.shared_records;
begin
  perform private.current_user_id();
  select * into existing from public.shared_records where id=record_id for update;
  if existing.id is null or not private.is_couple_member(existing.couple_id) then raise exception 'Kayıt bulunamadı veya erişim izniniz yok.' using errcode='42501'; end if;
  if expected_version is null or expected_version < 1 or existing.version <> expected_version then raise exception 'Bu kayıt değişti. Yenileyip tekrar deneyin.' using errcode='40001'; end if;
  delete from public.shared_records where id=record_id;
end;
$$;

create function public.send_kiss(expected_couple uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); current_couple uuid; partner uuid;
begin
  select couple_id into current_couple from public.couple_members where couple_members.user_id=actor_id;
  if expected_couple is not null and current_couple is distinct from expected_couple then raise exception 'Eşleşme değişti. Lütfen yenileyin.' using errcode='40001'; end if;
  perform 1 from public.couples where id=current_couple for share;
  if current_couple is null or not private.is_couple_member(current_couple) then raise exception 'Önce partnerinizle eşleşin.' using errcode='42501'; end if;
  select couple_members.user_id into partner from public.couple_members where couple_id=current_couple and couple_members.user_id<>actor_id;
  if partner is null then raise exception 'Partner bulunamadı.' using errcode='22023'; end if;
  insert into public.notifications(recipient_id,couple_id,title,body,kind) values(partner,current_couple,'Sana bir öpücük var 💋','Partnerin sana küçük bir sevgi gönderdi.','kiss');
end;
$$;

-- Profile and the shared relationship date are committed together. A missing
-- profile or a pairing lost while saving must never report a partial success.
create function public.update_app_profile(profile_patch jsonb, expected_couple uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); current_couple uuid; key_name text; new_date date;
begin
  if profile_patch is null or jsonb_typeof(profile_patch) <> 'object' then raise exception 'Profil verisi geçersiz.' using errcode='22023'; end if;
  for key_name in select jsonb_object_keys(profile_patch) loop
    if key_name not in ('name','relationshipDate') then raise exception 'Desteklenmeyen profil alanı.' using errcode='22023'; end if;
  end loop;
  if profile_patch ? 'name' and (jsonb_typeof(profile_patch -> 'name') <> 'string' or char_length(btrim(profile_patch ->> 'name')) not between 1 and 80) then
    raise exception 'İsim 1–80 karakter olmalıdır.' using errcode='22023';
  end if;
  if profile_patch ? 'relationshipDate' then
    if jsonb_typeof(profile_patch -> 'relationshipDate') <> 'string' then raise exception 'İlişki tarihi geçersiz.' using errcode='22023'; end if;
    if profile_patch ->> 'relationshipDate' <> '' then
      if profile_patch ->> 'relationshipDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'İlişki tarihi YYYY-MM-DD biçiminde olmalıdır.' using errcode='22023'; end if;
      new_date := (profile_patch ->> 'relationshipDate')::date;
      if new_date < date '1900-01-01' or new_date > current_date then raise exception 'Geçerli bir geçmiş tarih girin.' using errcode='22023'; end if;
    end if;
    select m.couple_id into current_couple from public.couple_members m where m.user_id=actor_id;
    if expected_couple is not null and current_couple is distinct from expected_couple then raise exception 'Eşleşme değişti. Lütfen yenileyin.' using errcode='40001'; end if;
    if current_couple is null then raise exception 'İlişki tarihini değiştirmek için önce eşleşin.' using errcode='42501'; end if;
    perform 1 from public.couples where id=current_couple for update;
    if not private.is_couple_member(current_couple) then raise exception 'Eşleşme değişti. Lütfen yenileyin.' using errcode='42501'; end if;
  end if;
  perform 1 from public.profiles where id=actor_id for update;
  if not found then raise exception 'Profil bulunamadı.' using errcode='42501'; end if;
  if profile_patch ? 'name' then
    update public.profiles set display_name=btrim(profile_patch ->> 'name') where id=actor_id;
  end if;
  if profile_patch ? 'relationshipDate' then
    update public.couples set relationship_date=new_date where id=current_couple;
    if not found then raise exception 'Eşleşme değişti. Lütfen yenileyin.' using errcode='42501'; end if;
  end if;
end;
$$;

-- Private Storage objects must be attached to an existing record belonging to
-- the first path component: <couple UUID>/<record UUID>/<file name>.
create function private.can_access_couple_object(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare couple_text text := split_part(object_name,'/',1); record_text text := split_part(object_name,'/',2);
begin
  if couple_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or record_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or split_part(object_name,'/',3)='' then return false; end if;
  return private.is_couple_member(couple_text::uuid) and exists (
    select 1 from public.shared_records r where r.id=record_text::uuid and r.couple_id=couple_text::uuid and r.category in ('documents','gallery','voice')
  );
end;
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('couple-files','couple-files',false,26214400,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp','image/heic','image/heif','audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/x-wav','audio/webm','audio/ogg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy ikimiz_files_read on storage.objects for select to authenticated using(bucket_id='couple-files' and private.can_access_couple_object(name));
create policy ikimiz_files_insert on storage.objects for insert to authenticated with check(bucket_id='couple-files' and private.can_access_couple_object(name));
create policy ikimiz_files_update on storage.objects for update to authenticated using(bucket_id='couple-files' and private.can_access_couple_object(name)) with check(bucket_id='couple-files' and private.can_access_couple_object(name));
create policy ikimiz_files_delete on storage.objects for delete to authenticated using(bucket_id='couple-files' and private.can_access_couple_object(name));

revoke all on function private.current_user_id(),private.is_couple_member(uuid),private.can_read_profile(uuid),private.touch_updated_at(),private.handle_new_user(),private.validate_shared_record(),private.can_access_couple_object(text) from public,anon,authenticated;
grant execute on function private.is_couple_member(uuid),private.can_read_profile(uuid),private.can_access_couple_object(text) to authenticated;
revoke all on function public.create_invitation(),public.accept_invitation(text),public.cancel_invitation(uuid),public.reject_invitation(text),public.leave_couple(),public.update_shared_record(uuid,integer,jsonb),public.delete_shared_record(uuid,integer),public.send_kiss(uuid),public.update_app_profile(jsonb,uuid) from public,anon;
grant execute on function public.create_invitation(),public.accept_invitation(text),public.cancel_invitation(uuid),public.reject_invitation(text),public.leave_couple(),public.update_shared_record(uuid,integer,jsonb),public.delete_shared_record(uuid,integer),public.send_kiss(uuid),public.update_app_profile(jsonb,uuid) to authenticated;

do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['shared_records','couple_members','profiles','couples','notifications','invitations'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end;
$$;

commit;

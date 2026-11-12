begin;

create table public.plant_waterings (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  watered_on date not null default ((now() at time zone 'Europe/Istanbul')::date),
  created_at timestamptz not null default now(),
  unique (couple_id, user_id, watered_on)
);

alter table public.plant_waterings enable row level security;
create policy plant_waterings_read on public.plant_waterings for select to authenticated
  using (private.is_couple_member(couple_id));

revoke all on public.plant_waterings from public, anon, authenticated;
grant select on public.plant_waterings to authenticated;

create function public.water_plant(expected_couple uuid) returns public.plant_waterings
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.current_user_id();
  current_couple uuid;
  today date := (now() at time zone 'Europe/Istanbul')::date;
  result public.plant_waterings;
begin
  select couple_id into current_couple from public.couple_members where user_id=actor_id;
  if current_couple is distinct from expected_couple then
    raise exception 'Eşleşme değişti. Lütfen yenileyin.' using errcode='40001';
  end if;
  if current_couple is null or not private.is_couple_member(current_couple) then
    raise exception 'Bitkiyi sulamak için önce eşleşin.' using errcode='42501';
  end if;
  if exists(select 1 from public.plant_waterings where couple_id=current_couple and user_id=actor_id and watered_on=today) then
    raise exception 'Bugün bitkiyi zaten suladın.' using errcode='22023';
  end if;
  insert into public.plant_waterings(couple_id,user_id,watered_on)
    values(current_couple,actor_id,today) returning * into result;
  update public.couples set watered_at=result.created_at where id=current_couple;
  return result;
end;
$$;

create function public.set_shared_plant(expected_couple uuid, new_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); current_couple uuid;
begin
  if new_kind not in ('heart','violet','cactus') then raise exception 'Bu bitki bulunamadı.' using errcode='22023'; end if;
  select couple_id into current_couple from public.couple_members where user_id=actor_id;
  if current_couple is distinct from expected_couple then raise exception 'Eşleşme değişti. Lütfen yenileyin.' using errcode='40001'; end if;
  if current_couple is null or not private.is_couple_member(current_couple) then raise exception 'Bitkiyi değiştirmek için önce eşleşin.' using errcode='42501'; end if;
  if exists(select 1 from public.couples where id=current_couple and plant_kind<>new_kind) then
    update public.couples set plant_kind=new_kind, watered_at=null where id=current_couple;
    delete from public.plant_waterings where couple_id=current_couple;
  end if;
end;
$$;

revoke all on function public.water_plant(uuid), public.set_shared_plant(uuid,text) from public, anon;
grant execute on function public.water_plant(uuid), public.set_shared_plant(uuid,text) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='plant_waterings') then
    alter publication supabase_realtime add table public.plant_waterings;
  end if;
end $$;

commit;

begin;

create table public.location_shares (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  heading double precision,
  accuracy double precision,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

alter table public.location_shares enable row level security;
create policy location_shares_read on public.location_shares for select to authenticated
  using (private.is_couple_member(couple_id));
revoke all on public.location_shares from public, anon, authenticated;
grant select on public.location_shares to authenticated;

create function public.update_location(expected_couple uuid, lat double precision, lon double precision, direction double precision, accuracy_m double precision)
returns public.location_shares language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); current_couple uuid; result public.location_shares;
begin
  select couple_id into current_couple from public.couple_members where user_id=actor_id;
  if current_couple is distinct from expected_couple or current_couple is null or not private.is_couple_member(current_couple) then
    raise exception 'Eşleşme değişti. Lütfen yenileyin.' using errcode='40001';
  end if;
  insert into public.location_shares(couple_id,user_id,latitude,longitude,heading,accuracy,active,updated_at)
    values(current_couple,actor_id,lat,lon,direction,accuracy_m,true,now())
    on conflict (couple_id,user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,heading=excluded.heading,accuracy=excluded.accuracy,active=true,updated_at=now()
    returning * into result;
  return result;
end;
$$;

create function public.stop_location(expected_couple uuid) returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); current_couple uuid;
begin
  select couple_id into current_couple from public.couple_members where user_id=actor_id;
  if current_couple is distinct from expected_couple then raise exception 'Eşleşme değişti. Lütfen yenileyin.' using errcode='40001'; end if;
  update public.location_shares set active=false,updated_at=now() where couple_id=current_couple and user_id=actor_id;
end;
$$;

revoke all on function public.update_location(uuid,double precision,double precision,double precision,double precision), public.stop_location(uuid) from public, anon;
grant execute on function public.update_location(uuid,double precision,double precision,double precision,double precision), public.stop_location(uuid) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='location_shares') then
    alter publication supabase_realtime add table public.location_shares;
  end if;
end $$;

commit;

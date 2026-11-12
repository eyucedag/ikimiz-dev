-- Notify the other partner whenever shared content is added, edited, or removed.
create or replace function private.notify_shared_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_row public.shared_records;
  partner uuid;
  actor uuid;
  action_title text;
  action_body text;
begin
  record_row := case when tg_op = 'DELETE' then old else new end;
  actor := record_row.created_by;

  select cm.user_id into partner
  from public.couple_members cm
  where cm.couple_id = record_row.couple_id
    and cm.user_id <> actor
  limit 1;

  if partner is null then
    return record_row;
  end if;

  action_title := case tg_op
    when 'INSERT' then 'Yeni bir ortak kayıt var'
    when 'UPDATE' then 'Ortak kayıt güncellendi'
    else 'Ortak kayıt kaldırıldı'
  end;
  action_body := case tg_op
    when 'INSERT' then 'Partnerin ortak alanınıza yeni bir şey ekledi.'
    when 'UPDATE' then 'Partnerin ortak alandaki bir kaydı değiştirdi.'
    else 'Partnerin ortak alandaki bir kaydı kaldırdı.'
  end;

  insert into public.notifications(recipient_id, couple_id, title, body, category, kind)
  values (partner, record_row.couple_id, action_title, action_body, record_row.category, 'activity');

  return record_row;
end;
$$;

drop trigger if exists shared_records_notify_partner on public.shared_records;
create trigger shared_records_notify_partner
after insert or update or delete on public.shared_records
for each row execute function private.notify_shared_record_change();

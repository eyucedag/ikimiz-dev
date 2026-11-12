import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// This process has no network credentials and never connects to Supabase.
const db = new PGlite({ extensions: { pgcrypto } });
const root = new URL('../', import.meta.url);
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
const D = '00000000-0000-4000-8000-000000000004';
const E = '00000000-0000-4000-8000-000000000005';
const F = '00000000-0000-4000-8000-000000000006';
let assertions = 0;

async function rows(sql, params = []) { return (await db.query(sql, params)).rows; }
async function first(sql, params = []) { return (await rows(sql, params))[0]; }
async function actor(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('set role authenticated');
}
async function denied(sql, params, code) {
  await assert.rejects(() => db.query(sql, params), (error) => {
    assert.equal(error.code, code, error.message);
    return true;
  });
  assertions++;
}
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
async function insert(coupleId, category, data, author = null) {
  return first('insert into public.shared_records(couple_id,category,data,created_by) values($1,$2,$3,coalesce($4::uuid,auth.uid())) returning *', [coupleId, category, data, author]);
}

try {
  await db.exec(await readFile(new URL('tests/rls.sql', root), 'utf8'));
  await db.exec(await readFile(new URL('migrations/202611100001_initial.sql', root), 'utf8'));
  await db.exec(await readFile(new URL('migrations/202611110002_daily_plant_watering.sql', root), 'utf8'));
  await db.exec(await readFile(new URL('migrations/202611110003_location_sharing.sql', root), 'utf8'));
  for (const [id, name] of [[A, 'Bir'], [B, 'İki'], [C, 'Üç'], [D, 'Dört'], [E, 'Beş'], [F, 'Altı']]) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { full_name: name, display_name: name }]);
  }

  await actor(A);
  equal((await first('select display_name from public.profiles where id=$1', [A])).display_name, 'Bir', 'Signup trigger creates the profile');
  await denied('select public.update_app_profile($1)', [{ name: 'Kaydedilmemeli', relationshipDate: '2024-07-21' }], '42501');
  equal((await first('select display_name from public.profiles where id=$1', [A])).display_name, 'Bir', 'Unpaired relationship save cannot partially change the name');
  equal((await rows('select * from public.profiles where id=$1', [B])).length, 0, 'Unpaired profiles are private');
  await denied('insert into public.couple_members(couple_id,user_id) values(gen_random_uuid(),auth.uid())', [], '42501');
  const inviteA = await first('select * from public.create_invitation()');
  equal(/^[A-HJ-NP-Z2-9]{6}$/.test(inviteA.code), true, 'Six-character cryptographic invitation');
  equal(inviteA.couple_id, null, 'Creating an invite does not create a solo couple');
  equal((await rows('select * from public.couple_members')).length, 0);
  await denied('select public.accept_invitation($1)', [inviteA.code], '22023');
  await actor(B);
  const coupleAB = (await first('select public.accept_invitation($1) as id', [inviteA.code])).id;
  equal((await rows('select * from public.couple_members')).length, 2, 'Both members enter atomically');
  equal((await rows('select * from public.profiles')).length, 2, 'Both partner profiles are visible');
  await db.query('select public.update_app_profile($1)', [{ name: 'Yeni isim', relationshipDate: '2024-07-21' }]);
  equal((await first('select display_name from public.profiles where id=$1', [B])).display_name, 'Yeni isim', 'Atomic profile RPC updates the account');
  equal((await first('select relationship_date::text as day from public.couples where id=$1', [coupleAB])).day, '2024-07-21', 'Atomic profile RPC updates the shared date');
  await denied('select public.update_app_profile($1)', [{ name: 'Değişmemeli', relationshipDate: '2026-02-30' }], '22008');
  equal((await first('select display_name from public.profiles where id=$1', [B])).display_name, 'Yeni isim', 'Invalid relationship data rolls back the whole profile operation');
  await denied('select public.update_app_profile($1,$2)', [{ name: 'Eski ekran', relationshipDate: '2024-07-22' }, 'ffffffff-ffff-4fff-8fff-ffffffffffff'], '40001');
  equal((await first('select display_name from public.profiles where id=$1', [B])).display_name, 'Yeni isim', 'A stale couple target cannot partially save the name');
  await denied('select public.send_kiss($1)', ['ffffffff-ffff-4fff-8fff-ffffffffffff'], '40001');
  await denied('select public.accept_invitation($1)', [inviteA.code], '22023');
  await denied('update public.couples set ended_at=now() where id=$1', [coupleAB], '42501');
  await denied('update public.invitations set status=$1 where id=$2', ['cancelled', inviteA.id], '42501');

  await actor(C);
  const inviteC = await first('select * from public.create_invitation()');
  await actor(D);
  const coupleCD = (await first('select public.accept_invitation($1) as id', [inviteC.code])).id;
  equal(coupleCD === coupleAB, false);
  equal((await rows('select * from public.profiles where id=$1', [A])).length, 0, 'Other couples cannot read a profile');
  await db.exec('reset role');
  await denied('insert into public.couple_members(couple_id,user_id) values($1,$2)', [coupleCD, A], '23505');

  await actor(A);
  await denied('select public.create_invitation()', [], '23505');
  const record = await insert(coupleAB, 'notebook', { title: 'Ortak not', body: 'İlk metin' });
  await actor(B);
  equal((await first('select data from public.shared_records where id=$1', [record.id])).data.body, 'İlk metin', 'B can read a record created by A');
  const edited = await first('select * from public.update_shared_record($1,$2,$3)', [record.id, 1, { title: 'Ortak not', body: 'Partner düzenledi' }]);
  equal(edited.version, 2, 'A successful write increments version');
  equal(edited.created_by, A, 'Editing preserves attribution');
  await denied('select * from public.update_shared_record($1,$2,$3)', [record.id, 1, { title: 'Eski veri' }], '40001');
  await denied('select * from public.update_shared_record($1,$2,$3)', [record.id, null, { title: 'Sürümü atla' }], '40001');
  await denied('update public.shared_records set data=$1 where id=$2', [{ title: 'Denetimsiz güncelleme' }, record.id], '42501');
  await denied('delete from public.shared_records where id=$1', [record.id], '42501');
  await denied('insert into public.shared_records(couple_id,category,data,created_by) values($1,$2,$3,$4)', [coupleAB, 'notebook', { title: 'Sahte gönderen' }, A], '42501');
  await actor(A);
  equal((await first('select data from public.shared_records where id=$1', [record.id])).data.body, 'Partner düzenledi', 'A sees B’s saved edit');
  await actor(C);
  equal((await rows('select * from public.shared_records where id=$1', [record.id])).length, 0, 'C cannot read AB’s content');
  await denied('select * from public.update_shared_record($1,$2,$3)', [record.id, 2, { title: 'Başka çift' }], '42501');
  await denied('select public.delete_shared_record($1,$2)', [record.id, 2], '42501');
  await denied('insert into public.shared_records(couple_id,category,data) values($1,$2,$3)', [coupleAB, 'notebook', { title: 'Başka çifte ekleme' }], '42501');

  await actor(A);
  const moodA = await insert(coupleAB, 'mood', { title: 'İyi', mood: 'İyi', date: '2026-11-10' });
  await denied('insert into public.shared_records(couple_id,category,data) values($1,$2,$3)', [coupleAB, 'mood', { title: 'Harika', mood: 'Harika', date: '2026-11-10' }], '23505');
  const songA = await insert(coupleAB, 'song', { title: 'İlk şarkı', body: 'Sanatçı', date: '2026-11-10' });
  await actor(B);
  await insert(coupleAB, 'mood', { title: 'Harika', mood: 'Harika', date: '2026-11-10' });
  const emojiMood = await insert(coupleAB, 'mood', { title: 'İyi', mood: '😊', date: '2026-11-11' });
  equal(emojiMood.data.mood, '😊', 'The UI’s true Unicode emoji mood payload is accepted unchanged');
  await insert(coupleAB, 'song', { title: 'İkinci şarkı', date: '2026-11-10' });
  equal((await first("select count(*)::integer as n from public.shared_records where category='song'")).n, 2, 'Two partner songs coexist on the same day');
  equal((await first('select * from public.update_shared_record($1,$2,$3)', [moodA.id, 1, { title: 'Yorgunum', mood: 'Yorgunum', date: '2026-11-10' }])).created_by, A, 'B may edit A’s mood too');
  await first('select * from public.update_shared_record($1,$2,$3)', [songA.id, 1, { title: 'Düzenlenmiş şarkı', date: '2026-11-10' }]);
  for (const [category, data, code] of [
    ['partner-note', { title: 'Not', body: 'x'.repeat(141) }, '22023'],
    ['mood', { title: 'İyi', mood: 'İyi', date: '2026-11-11', body: 'x'.repeat(281) }, '22023'],
    ['mood', { title: 'Yanlış', mood: 'olmayan', date: '2026-11-11' }, '22023'],
    ['calendar', { title: 'Tarih yok' }, '22023'],
    ['calendar', { title: 'Hatalı gün', date: '2026-02-30' }, '22008'],
    ['calendar', { title: 'Hatalı saat', date: '2026-11-10', time: '25:00' }, '22023'],
    ['documents', { title: 'Hatalı bağlantı', url: 'javascript:alert(1)' }, '22023'],
    ['notebook', { title: 'Kimlik taklidi', authorId: B }, '22023'],
    ['lists', { title: 'Tekrarlı madde', items: [{ id: '1', text: 'A', done: false }, { id: '1', text: 'B', done: false }] }, '22023'],
  ]) {
    await denied('insert into public.shared_records(couple_id,category,data) values($1,$2,$3)', [coupleAB, category, data], code);
  }

  await actor(A);
  const doc = await insert(coupleAB, 'documents', { title: 'Ortak belge', url: 'https://example.com/belge' });
  const objectPath = `${coupleAB}/${doc.id}/belge.pdf`;
  await actor(B);
  await db.query('insert into storage.objects(bucket_id,name,owner) values($1,$2,$3)', ['couple-files', objectPath, A]);
  equal((await rows('select * from storage.objects where name=$1', [objectPath])).length, 1, 'B can manage an A-owned Storage object in the couple');
  await actor(C);
  equal((await rows('select * from storage.objects where name=$1', [objectPath])).length, 0, 'C cannot read AB files');
  await denied('insert into storage.objects(bucket_id,name) values($1,$2)', ['couple-files', `${coupleAB}/${doc.id}/other.pdf`], '42501');
  equal((await first('select private.can_access_couple_object($1) as allowed', ['malformed/path/file.pdf'])).allowed, false, 'Malformed Storage paths do not throw or authorize');
  await actor(B);
  equal((await rows('delete from storage.objects where name=$1 returning id', [objectPath])).length, 1, 'B can delete an A-owned shared file');
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['couple-files', objectPath]);
  await db.query('select public.delete_shared_record($1,$2)', [doc.id, 1]);
  equal((await rows('select * from storage.objects where name=$1', [objectPath])).length, 0, 'An orphan file is inaccessible after record deletion');
  await db.query('select public.delete_shared_record($1,$2)', [record.id, 2]);
  await actor(A);
  equal((await rows('select * from public.shared_records where id=$1', [record.id])).length, 0, 'B can delete A’s shared record');

  await db.query('select public.send_kiss()');
  const ownNotifications = await rows('select * from public.notifications');
  equal(ownNotifications.every(n => n.recipient_id === A), true, 'Notifications are recipient-only');
  await actor(B);
  const kiss = await first("select * from public.notifications where kind='kiss'");
  equal(kiss.recipient_id, B, 'A’s kiss goes only to the partner');
  await db.query('update public.notifications set read=true where id=$1', [kiss.id]);
  await denied('update public.notifications set title=$1 where id=$2', ['Sahte başlık', kiss.id], '42501');
  await denied('select private.current_user_id()', [], '42501');

  await actor(E);
  const cancel = await first('select * from public.create_invitation()');
  await db.query('select public.cancel_invitation($1)', [cancel.id]);
  equal((await first('select status from public.invitations where id=$1', [cancel.id])).status, 'cancelled');
  const reject = await first('select * from public.create_invitation()');
  await actor(F);
  await db.query('select public.reject_invitation($1)', [reject.code]);
  await actor(E);
  equal((await first('select status from public.invitations where id=$1', [reject.id])).status, 'rejected');
  const expire = await first('select * from public.create_invitation()');
  await db.exec('reset role');
  await db.query("update public.invitations set expires_at=now()-interval '1 minute' where id=$1", [expire.id]);
  await actor(F);
  await denied('select public.accept_invitation($1)', [expire.code], '22023');
  equal((await rows('select * from public.couple_members')).length, 0, 'Expired accept leaves no partial membership');

  await actor(B);
  await db.query('select public.leave_couple()');
  await actor(A);
  equal((await rows('select * from public.shared_records')).length, 0, 'Ending a pairing removes both members’ access');
  equal((await rows('select * from public.couple_members')).length, 0);
  equal((await rows('select * from public.profiles where id=$1', [B])).length, 0, 'Old partner profile is no longer visible');
  const fresh = await first('select * from public.create_invitation()');
  await actor(F);
  const newCouple = (await first('select public.accept_invitation($1) as id', [fresh.code])).id;
  equal(newCouple === coupleAB, false, 'Re-pairing creates a separate content boundary');
  equal((await rows('select * from public.shared_records')).length, 0, 'A new partner never inherits the old couple’s content');

  await db.exec('reset role');
  const bucket = await first("select * from storage.buckets where id='couple-files'");
  equal(bucket.public, false);
  equal(Number(bucket.file_size_limit), 25 * 1024 * 1024);
  equal((await first("select count(*)::integer as n from pg_publication_tables where pubname='supabase_realtime'")).n, 8, 'Realtime tables are registered');
  await db.query('delete from public.profiles where id=$1', [F]);
  await actor(F);
  await denied('select public.update_app_profile($1)', [{ name: 'Eksik profil' }], '42501');
  await db.exec('reset role');
  await db.exec('set role anon');
  await denied('select public.create_invitation()', [], '42501');
  equal((await rows('select has_table_privilege(current_user,$1,$2) as allowed', ['public.shared_records', 'select']))[0].allowed, false, 'Anonymous clients cannot read records');
  console.log(`Database checks passed: ${assertions} assertions (disposable PostgreSQL; no live data).`);
} catch (error) {
  console.error('Database check failed:', { message: error.message, code: error.code, position: error.position, where: error.where, stack: error.stack?.split('\n').slice(1, 3).join('\n') });
  process.exitCode = 1;
} finally {
  await db.close();
}

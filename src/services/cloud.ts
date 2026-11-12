import type { AppNotification, AppSettings, CategoryId, PlantWatering, Profile, RecordInput, RecordPatch, SharedRecord } from '../types';
import { cloudError, requireSupabase } from './supabase';

interface RecordRow {
  id: string; couple_id: string; category: CategoryId; data: Omit<RecordInput, 'category'>;
  created_by: string; created_at: string; updated_at: string; version: number;
}
interface NotificationRow { id: string; title: string; body: string; category: CategoryId | null; kind: string; created_at: string; read: boolean }

function fromRow(row: RecordRow): SharedRecord {
  return { ...row.data, id: row.id, category: row.category, authorId: row.created_by,
    createdAt: row.created_at, updatedAt: row.updated_at, version: row.version };
}

function recordData(input: RecordInput) {
  const data = {
    title: input.title, body: input.body, date: input.date, time: input.time,
    location: input.location, done: input.done, items: input.items,
    url: input.url, mood: input.mood, specialDayType: input.specialDayType, price: input.price,
    deliveryAt: input.deliveryAt, distanceKm: input.distanceKm,
  };
  // PostgREST must receive actual JSON rather than properties set to undefined.
  return JSON.parse(JSON.stringify(data)) as Omit<RecordInput, 'category'>;
}

export async function loadCloudData(userId: string, coupleId: string | null): Promise<{
  records: SharedRecord[]; profile: Profile; notifications: AppNotification[];
  sharedSettings: Pick<AppSettings, 'plant' | 'wateredAt' | 'plantWaterings'>;
}> {
  const client = requireSupabase();
  const [own, membership, notifications, records, couple, waterings] = await Promise.all([
    client.from('profiles').select('display_name,full_name').eq('id', userId).single(),
    coupleId ? client.from('couple_members').select('user_id').eq('couple_id', coupleId).neq('user_id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    client.from('notifications').select('id,title,body,category,kind,created_at,read').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(100),
    coupleId ? client.from('shared_records').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    coupleId ? client.from('couples').select('relationship_date,plant_kind,watered_at').eq('id', coupleId).single() : Promise.resolve({ data: null, error: null }),
    coupleId ? client.from('plant_waterings').select('user_id,watered_on,created_at').eq('couple_id', coupleId).order('watered_on', { ascending: true }).limit(120) : Promise.resolve({ data: [], error: null }),
  ]);
  const failed = [own, membership, notifications, records, couple, waterings].find(result => result.error);
  if (failed?.error) throw cloudError(failed.error);
  let partnerName = '';
  if (membership.data?.user_id) {
    const partner = await client.from('profiles').select('display_name,full_name').eq('id', membership.data.user_id).single();
    if (partner.error) throw cloudError(partner.error);
    partnerName = partner.data.display_name || partner.data.full_name || '';
  }
  return {
    records: ((records.data || []) as RecordRow[]).map(fromRow),
    profile: { name: own.data?.display_name || own.data?.full_name || '', partnerName,
      relationshipDate: couple.data?.relationship_date || '' },
    sharedSettings: {
      plant: (couple.data?.plant_kind || 'heart') as AppSettings['plant'],
      wateredAt: couple.data?.watered_at || null,
      plantWaterings: ((waterings.data || []) as { user_id: string; watered_on: string; created_at: string }[]).map(row => ({ userId: row.user_id, date: row.watered_on, createdAt: row.created_at })),
    },
    notifications: ((notifications.data || []) as NotificationRow[]).map(n => ({ id: n.id, title: n.title, body: n.body,
      createdAt: n.created_at, read: n.read, kind: n.kind, ...(n.category ? { category: n.category } : {}) })),
  };
}

export async function waterCloudPlant(coupleId: string): Promise<PlantWatering> {
  const { data, error } = await requireSupabase().rpc('water_plant', { expected_couple: coupleId }).single();
  if (error) throw cloudError(error);
  const row = data as { user_id: string; watered_on: string; created_at: string };
  return { userId: row.user_id, date: row.watered_on, createdAt: row.created_at };
}

export async function updateCloudPlant(coupleId: string, patch: Pick<AppSettings, 'plant' | 'wateredAt'>): Promise<void> {
  const { error } = await requireSupabase().rpc('set_shared_plant', { expected_couple: coupleId, new_kind: patch.plant });
  if (error) throw cloudError(error);
}

export async function addCloudRecord(coupleId: string, input: RecordInput, userId: string): Promise<SharedRecord> {
  const { data, error } = await requireSupabase().from('shared_records')
    .insert({ couple_id: coupleId, category: input.category, data: recordData(input), created_by: userId }).select('*').single();
  if (error) throw cloudError(error);
  return fromRow(data as RecordRow);
}

export async function updateCloudRecord(record: SharedRecord, patch: RecordPatch): Promise<SharedRecord> {
  if (patch.category && patch.category !== record.category) throw new Error('Kayıt kategorisi değiştirilemez.');
  const { data, error } = await requireSupabase().rpc('update_shared_record', {
    record_id: record.id, expected_version: record.version, record_data: recordData({ ...record, ...patch }),
  }).single();
  if (error) throw cloudError(error);
  return fromRow(data as RecordRow);
}

export async function deleteCloudRecord(record: SharedRecord): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_shared_record', { record_id: record.id, expected_version: record.version });
  if (error) throw cloudError(error);
}

export async function updateCloudProfile(_userId: string, coupleId: string | null, patch: Partial<Profile>): Promise<void> {
  const client = requireSupabase();
  if (patch.partnerName !== undefined) throw new Error('Partnerinin adı kendi profilinden güncellenir.');
  if (patch.relationshipDate !== undefined && !coupleId) throw new Error('İlişki tarihini kaydetmek için önce partnerinle eşleşmelisin.');
  const profilePatch: Partial<Profile> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name || name.length > 80) throw new Error('Adın 1–80 karakter arasında olmalı.');
    profilePatch.name = name;
  }
  if (patch.relationshipDate !== undefined) profilePatch.relationshipDate = patch.relationshipDate;
  if (!Object.keys(profilePatch).length) return;
  const { error } = await client.rpc('update_app_profile', { profile_patch: profilePatch, expected_couple: coupleId });
  if (error) throw cloudError(error);
}

export async function markCloudNotificationsRead(userId: string): Promise<void> {
  const { error } = await requireSupabase().from('notifications').update({ read: true }).eq('recipient_id', userId).eq('read', false);
  if (error) throw cloudError(error);
}

export async function sendCloudKiss(coupleId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('send_kiss', { expected_couple: coupleId });
  if (error) throw cloudError(error);
}

export function subscribeCloud(coupleId: string | null, userId: string, onChange: () => void): () => void {
  const client = requireSupabase();
  const channel = client.channel(`ikimiz-data-${userId}-${coupleId || 'unpaired'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange);
  if (coupleId) {
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shared_records', filter: `couple_id=eq.${coupleId}` }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shared_records', filter: `couple_id=eq.${coupleId}` }, onChange)
      // DELETE events under RLS only carry primary keys. Never inspect or apply
      // their payload; refetch the current couple through its normal policies.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shared_records' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` }, onChange);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'plant_waterings', filter: `couple_id=eq.${coupleId}` }, onChange);
  }
  channel.subscribe(status => { if (status === 'SUBSCRIBED') onChange(); });
  return () => { void client.removeChannel(channel); };
}

export async function signedFileUrl(path: string): Promise<string> {
  const { data, error } = await requireSupabase().storage.from('couple-files').createSignedUrl(path, 60);
  if (error) throw cloudError(error);
  return data.signedUrl;
}

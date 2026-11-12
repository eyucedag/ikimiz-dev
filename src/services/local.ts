import { categories, defaultHomeOrder, moods } from '../constants/categories';
import type { AppData, AppSettings, CategoryId, Profile, RecordInput, RecordPatch, SharedRecord } from '../types';
import { localDay, parseLocalDay } from '../utils/date';

export const LOCAL_STORAGE_KEY = 'ikimiz:local:v1';
export const LOCAL_USER_ID = 'local-preview-user';
const categoryIds = new Set(categories.map(category => category.id));
const homeIds = new Set<string>(defaultHomeOrder);

export function createEmptyData(): AppData {
  return {
    records: [],
    profile: { name: '', partnerName: '', relationshipDate: '' },
    settings: { homeOrder: [...defaultHomeOrder], hiddenCards: [], plant: 'heart', wateredAt: null, plantStartedAt: null, plantWaterings: [] },
    notifications: [],
  };
}

export function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function validateRecord(input: RecordInput): RecordInput {
  if (!categoryIds.has(input.category)) throw new Error('Bu kategori bulunamadı.');
  const title = input.title.trim();
  if (!title) throw new Error('Bir başlık yazmalısın.');
  if (title.length > 200) throw new Error('Başlık en fazla 200 karakter olabilir.');
  const result = { ...input, title };
  if (result.body !== undefined) result.body = result.body.trim();
  if (result.date && !parseLocalDay(result.date)) throw new Error('Geçerli bir tarih yazmalısın (YYYY-AA-GG).');
  if (result.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(result.time)) throw new Error('Saati SS:DD biçiminde yazmalısın.');
  if (result.category === 'calendar' || result.category === 'special-days' || result.category === 'places') {
    if (!result.date) throw new Error('Bu kayıt için bir tarih seçmelisin.');
  }
  if (result.category === 'mood' || result.category === 'song') result.date ||= localDay();
  if (result.category === 'mood') {
    const selectedMood = moods.find(mood => mood.label === result.mood || mood.emoji === result.mood);
    if (!selectedMood) throw new Error('Bir ruh hâli seçmelisin.');
    result.title = selectedMood.label;
    result.mood = selectedMood.emoji;
    if ((result.body?.length ?? 0) > 280) throw new Error('Ruh hâli notu en fazla 280 karakter olabilir.');
  }
  if (result.category === 'partner-note' && (result.body || result.title).length > 140) {
    throw new Error('Partner notu en fazla 140 karakter olabilir.');
  }
  if (result.url && result.category !== 'gallery') {
    result.url = result.url.trim();
    try {
      const url = new URL(result.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    } catch {
      throw new Error('Bağlantı http:// veya https:// ile başlayan geçerli bir adres olmalı.');
    }
  }
  if (result.items) {
    const ids = new Set<string>();
    result.items = result.items.map(item => {
      if (!item.id || ids.has(item.id)) throw new Error('Liste maddeleri yinelenmemeli.');
      ids.add(item.id);
      const text = item.text.trim();
      if (!text) throw new Error('Liste maddesi boş bırakılamaz.');
      return { id: item.id, text, done: Boolean(item.done) };
    });
  }
  return result;
}

export function addRecordToData(data: AppData, input: RecordInput, userId = LOCAL_USER_ID, now = new Date()): AppData {
  const valid = validateRecord(input);
  const existing = (valid.category === 'mood' || valid.category === 'song')
    ? data.records.find(record => record.category === valid.category && record.authorId === userId && record.date === valid.date)
    : undefined;
  if (existing) return updateRecordInData(data, existing.id, valid, now);
  const timestamp = now.toISOString();
  const record: SharedRecord = { ...valid, id: newId(), authorId: userId, createdAt: timestamp, updatedAt: timestamp, version: 1 };
  return { ...data, records: [record, ...data.records] };
}

export function updateRecordInData(data: AppData, id: string, patch: RecordPatch, now = new Date()): AppData {
  const current = data.records.find(record => record.id === id);
  if (!current) throw new Error('Bu kayıt artık bulunamıyor. Sayfayı yenileyebilirsin.');
  if (patch.category && patch.category !== current.category) throw new Error('Bir kaydın kategorisi değiştirilemez.');
  const valid = validateRecord({ ...current, ...patch });
  const duplicate = (valid.category === 'mood' || valid.category === 'song') && data.records.some(record =>
    record.id !== id && record.category === valid.category && record.authorId === current.authorId && record.date === valid.date);
  if (duplicate) throw new Error('Bu kişi için aynı gün zaten bir kayıt var.');
  return {
    ...data,
    records: data.records.map(record => record.id === id
      ? { ...record, ...valid, id: current.id, authorId: current.authorId, createdAt: current.createdAt, updatedAt: now.toISOString(), version: current.version + 1 }
      : record),
  };
}

export function deleteRecordFromData(data: AppData, id: string): AppData {
  if (!data.records.some(record => record.id === id)) throw new Error('Bu kayıt artık bulunamıyor.');
  return { ...data, records: data.records.filter(record => record.id !== id) };
}

export function assertRecordVersion(data: AppData, id: string, expectedVersion?: number): void {
  const current = data.records.find(record => record.id === id);
  if (!current) throw new Error('Bu kayıt artık bulunamıyor. Sayfayı yenileyebilirsin.');
  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    throw new Error('Bu kayıt başka bir ekranda değiştirildi. Güncel kaydı açıp yeniden dene.');
  }
}

export function validateProfile(profile: Profile): Profile {
  const result = { name: profile.name.trim(), partnerName: profile.partnerName.trim(), relationshipDate: profile.relationshipDate };
  if (result.name.length > 80 || result.partnerName.length > 80) throw new Error('İsimler en fazla 80 karakter olabilir.');
  if (result.relationshipDate && (!parseLocalDay(result.relationshipDate) || result.relationshipDate > localDay())) {
    throw new Error('İlişki başlangıcı bugün veya daha önceki geçerli bir tarih olmalı.');
  }
  return result;
}

export function validateSettings(settings: AppSettings): AppSettings {
  if (!['heart', 'violet', 'cactus'].includes(settings.plant)) throw new Error('Bu bitki bulunamadı.');
  const order = [...new Set(settings.homeOrder)].filter(id => homeIds.has(id));
  const hidden = [...new Set(settings.hiddenCards)].filter(id => homeIds.has(id));
  const plantStartedAt = typeof settings.plantStartedAt === 'string' && Number.isFinite(Date.parse(settings.plantStartedAt))
    ? settings.plantStartedAt : null;
  const plantWaterings = Array.isArray(settings.plantWaterings) ? settings.plantWaterings.filter(item => item && typeof item.userId === 'string' && Boolean(parseLocalDay(item.date)) && typeof item.createdAt === 'string') : [];
  return { ...settings, plantStartedAt, plantWaterings, homeOrder: [...order, ...defaultHomeOrder.filter(id => !order.includes(id))], hiddenCards: hidden };
}

/** Load/save are intentionally separate from pure transformations for focused tests. */
export async function loadLocalData(): Promise<AppData> {
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  const raw = await storage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return createEmptyData();
  try {
    const value = JSON.parse(raw) as AppData;
    if (!Array.isArray(value.records) || !Array.isArray(value.notifications) || !value.profile || !value.settings) throw new Error();
    if (!Array.isArray(value.settings.homeOrder) || !Array.isArray(value.settings.hiddenCards)) throw new Error();
    const profile = validateProfile(value.profile);
    const settings = validateSettings(value.settings);
    const records = value.records.map(record => {
      if (!record.id || !record.authorId || !record.createdAt || !record.updatedAt || !Number.isInteger(record.version)) throw new Error();
      return { ...record, ...validateRecord(record) };
    });
    return { records, profile, settings, notifications: value.notifications };
  } catch {
    throw new Error('Cihazdaki kayıtlar okunamadı. Verilerin korunuyor; sayfayı yenileyerek tekrar deneyebilirsin.');
  }
}

export async function saveLocalData(data: AppData): Promise<void> {
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  await storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

export async function loadAccountSettings(userId: string): Promise<AppSettings> {
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  const raw = await storage.getItem(`ikimiz:preferences:${userId}`);
  if (!raw) return createEmptyData().settings;
  try {
    const value = JSON.parse(raw) as AppSettings;
    if (!Array.isArray(value.homeOrder) || !Array.isArray(value.hiddenCards)) throw new Error();
    return validateSettings(value);
  } catch {
    throw new Error('Görünüm tercihleri okunamadı. Tekrar deneyebilirsin.');
  }
}

export async function saveAccountSettings(userId: string, settings: AppSettings): Promise<void> {
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  await storage.setItem(`ikimiz:preferences:${userId}`, JSON.stringify(settings));
}

export function isCategoryId(value: string): value is CategoryId {
  return categoryIds.has(value as CategoryId);
}

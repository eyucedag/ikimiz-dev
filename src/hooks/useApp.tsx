import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AppData, AppSettings, Profile, RecordInput, RecordPatch } from '../types';
import {
  addRecordToData, assertRecordVersion, createEmptyData, deleteRecordFromData, loadAccountSettings,
  loadLocalData, LOCAL_USER_ID, newId, saveAccountSettings, saveLocalData,
  updateRecordInData, validateProfile, validateRecord, validateSettings,
} from '../services/local';
import {
  addCloudRecord, deleteCloudRecord, loadCloudData, markCloudNotificationsRead,
  sendCloudKiss, subscribeCloud, updateCloudPlant, updateCloudProfile, updateCloudRecord, waterCloudPlant,
} from '../services/cloud';
import { useAuth } from './useAuth';
import { localDay } from '../utils/date';

interface AppContextValue extends AppData {
  ready: boolean;
  mode: 'local' | 'cloud';
  userId: string;
  error: string | null;
  addRecord: (input: RecordInput) => Promise<void>;
  updateRecord: (id: string, patch: RecordPatch, expectedVersion?: number) => Promise<void>;
  deleteRecord: (id: string, expectedVersion?: number) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  markAllRead: () => Promise<void>;
  sendKiss: () => Promise<void>;
  waterPlant: () => Promise<void>;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'İşlem tamamlanamadı. Tekrar deneyebilirsin.';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const identity = `${auth.session?.user.id ?? LOCAL_USER_ID}:${auth.pairing.coupleId ?? ''}`;
  // Remount the data owner on an account/couple transition. Old snapshots and
  // pending queues never become the new account's initial data, even for a frame.
  return <ScopedAppProvider key={identity}>{children}</ScopedAppProvider>;
}

function ScopedAppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const mode = auth.session ? 'cloud' : 'local';
  const userId = auth.session?.user.id ?? LOCAL_USER_ID;
  const coupleId = auth.pairing.coupleId;
  const [data, setData] = useState<AppData>(createEmptyData);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  const activeRef = useRef(true);
  const readyRef = useRef(false);
  const writableRef = useRef(false);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const commit = useCallback((next: AppData) => {
    if (!activeRef.current) throw new Error('Oturum değişti. Güncel ekranda tekrar deneyebilirsin.');
    dataRef.current = next;
    setData(next);
  }, []);

  const enqueue = useCallback((operation: () => Promise<void>) => {
    const next = queueRef.current.catch(() => undefined).then(operation);
    queueRef.current = next;
    return next;
  }, []);

  const reload = useCallback(() => enqueue(async () => {
    if (!activeRef.current) return;
    try {
      let next: AppData;
      if (mode === 'local') {
        next = await loadLocalData();
      } else {
        const [cloud, accountSettings] = await Promise.all([
          loadCloudData(userId, coupleId),
          loadAccountSettings(userId),
        ]);
        const samePlant = accountSettings.plant === cloud.sharedSettings.plant;
        const { sharedSettings, ...cloudData } = cloud;
        next = {
          ...cloudData,
          settings: {
            ...accountSettings,
            ...sharedSettings,
            plantStartedAt: samePlant ? (accountSettings.plantStartedAt ?? sharedSettings.wateredAt) : sharedSettings.wateredAt,
          },
        };
      }
      if (!activeRef.current) return;
      commit(next);
      writableRef.current = true;
      setError(null);
    } catch (cause) {
      if (!activeRef.current) return;
      // Keep the last successful snapshot. Never overwrite unreadable storage.
      writableRef.current = false;
      setError(messageOf(cause));
      throw cause;
    } finally {
      if (activeRef.current) {
        readyRef.current = true;
        setReady(true);
      }
    }
  }), [commit, coupleId, enqueue, mode, userId]);

  useEffect(() => {
    if (!auth.loading) void reload().catch(() => undefined);
  }, [auth.loading, reload]);

  useEffect(() => {
    if (auth.loading) return;
    const refresh = () => { void reload().catch(() => undefined); };
    let midnightTimer: ReturnType<typeof setTimeout> | undefined;
    const clearMidnight = () => { if (midnightTimer !== undefined) clearTimeout(midnightTimer); };
    const scheduleMidnight = () => {
      clearMidnight();
      const now = new Date();
      // Local calendar construction handles 23/25-hour days across DST changes.
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnightTimer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, Math.max(1, nextMidnight.getTime() - now.getTime() + 50));
    };
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') scheduleMidnight();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { refresh(); scheduleMidnight(); }
      else clearMidnight();
    });
    const unsubscribe = mode === 'cloud' ? subscribeCloud(coupleId, userId, refresh) : undefined;
    return () => { clearMidnight(); subscription.remove(); unsubscribe?.(); };
  }, [auth.loading, coupleId, mode, reload, userId]);

  const mutate = useCallback((operation: (current: AppData) => Promise<AppData>) => enqueue(async () => {
    try {
      if (!activeRef.current) throw new Error('Oturum değişti. Tekrar deneyebilirsin.');
      if (!readyRef.current || !writableRef.current) throw new Error('Veriler henüz hazır değil. Yenileyip tekrar deneyebilirsin.');
      const next = await operation(dataRef.current);
      if (mode === 'local') await saveLocalData(next);
      commit(next);
      setError(null);
    } catch (cause) {
      if (activeRef.current) setError(messageOf(cause));
      throw cause;
    }
  }), [commit, enqueue, mode]);

  const requireCouple = () => {
    if (!coupleId) throw new Error('Ortak alana kayıt eklemek için önce partnerinle eşleşmelisin.');
    return coupleId;
  };

  const addRecord = (input: RecordInput) => mutate(async current => {
    const valid = validateRecord(input);
    if (mode === 'local') return addRecordToData(current, valid, userId);
    const sharedCoupleId = requireCouple();
    const existing = (valid.category === 'mood' || valid.category === 'song')
      ? current.records.find(record => record.category === valid.category && record.authorId === userId && record.date === valid.date)
      : undefined;
    const record = existing
      ? await updateCloudRecord(existing, valid)
      : await addCloudRecord(sharedCoupleId, valid, userId);
    return { ...current, records: [record, ...current.records.filter(item => item.id !== record.id)] };
  });

  const updateRecord = (id: string, patch: RecordPatch, expectedVersion?: number) => mutate(async current => {
    assertRecordVersion(current, id, expectedVersion);
    // Shared pure validation also catches changing daily records into a duplicate.
    const validated = updateRecordInData(current, id, patch);
    if (mode === 'local') return validated;
    requireCouple();
    const existing = current.records.find(record => record.id === id)!;
    const validatedRecord = validated.records.find(record => record.id === id)!;
    const { id: _id, authorId: _authorId, createdAt: _createdAt, updatedAt: _updatedAt, version: _version, ...input } = validatedRecord;
    const record = await updateCloudRecord(existing, input);
    return { ...current, records: current.records.map(item => item.id === id ? record : item) };
  });

  const deleteRecord = (id: string, expectedVersion?: number) => mutate(async current => {
    assertRecordVersion(current, id, expectedVersion);
    const next = deleteRecordFromData(current, id);
    if (mode === 'cloud') {
      requireCouple();
      await deleteCloudRecord(current.records.find(record => record.id === id)!);
    }
    return next;
  });

  const updateProfile = (patch: Partial<Profile>) => mutate(async current => {
    const profile = validateProfile({ ...current.profile, ...patch });
    if (mode === 'cloud') {
      if (patch.partnerName !== undefined && patch.partnerName !== current.profile.partnerName) {
        throw new Error('Partnerinin adı kendi profilinden güncellenir.');
      }
      if (patch.relationshipDate !== undefined && !coupleId) requireCouple();
      const ownPatch: Partial<Profile> = {};
      if (patch.name !== undefined) ownPatch.name = profile.name;
      if (patch.relationshipDate !== undefined) ownPatch.relationshipDate = profile.relationshipDate;
      await updateCloudProfile(userId, coupleId, ownPatch);
    }
    return { ...current, profile };
  });

  const updateSettings = (patch: Partial<AppSettings>) => mutate(async current => {
    const settings = validateSettings({ ...current.settings, ...patch });
    if (mode === 'cloud') {
      if (patch.plant !== undefined) {
        await updateCloudPlant(requireCouple(), { plant: settings.plant, wateredAt: settings.wateredAt });
      }
      await saveAccountSettings(userId, settings);
    }
    return { ...current, settings };
  });

  const markAllRead = () => mutate(async current => {
    if (mode === 'cloud') await markCloudNotificationsRead(userId);
    return { ...current, notifications: current.notifications.map(item => ({ ...item, read: true })) };
  });

  const sendKiss = () => mutate(async current => {
    if (mode === 'cloud') {
      await sendCloudKiss(requireCouple());
      return current;
    }
    return {
      ...current,
      notifications: [{
        id: newId(), title: 'Öpücük önizlemesi',
        body: 'Bu cihazdaki deneme alanında bir öpücük animasyonu açtın. Partnerine gönderilmedi.',
        createdAt: new Date().toISOString(), read: false,
      }, ...current.notifications],
    };
  });

  const waterPlant = () => mutate(async current => {
    const today = localDay();
    if (current.settings.plantWaterings.some(item => item.userId === userId && item.date === today)) {
      throw new Error('Bugün bitkiyi zaten suladın. Yarın yeniden ilgilenebilirsin.');
    }
    const timestamp = new Date().toISOString();
    const watering = mode === 'cloud'
      ? await waterCloudPlant(requireCouple())
      : { userId, date: today, createdAt: timestamp };
    const settings = validateSettings({
      ...current.settings,
      wateredAt: watering.createdAt,
      plantStartedAt: current.settings.plantStartedAt || watering.createdAt,
      plantWaterings: [...current.settings.plantWaterings, watering],
    });
    if (mode === 'cloud') await saveAccountSettings(userId, settings);
    return { ...current, settings };
  });

  return <AppContext.Provider value={{
    ...data, ready: ready && !auth.loading, mode, userId, error, addRecord, updateRecord, deleteRecord,
    updateProfile, updateSettings, markAllRead, sendKiss, waterPlant, reload,
  }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp, AppProvider içinde kullanılmalı.');
  return value;
}

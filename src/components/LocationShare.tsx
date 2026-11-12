import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { theme } from '../constants/theme';
import { AppText, Icon } from './ui';
import { useAuth } from '../hooks/useAuth';
import { requireSupabase } from '../services/supabase';
import { partnerDirection, type Coordinates } from '../utils/partnerDirection';

interface PartnerLocation extends Coordinates { active: boolean; coupleId: string; observerId: string }

export function LocationShare({ onLetter, onKiss, onCustomize, kissDisabled }: { onLetter?: () => void; onKiss?: () => void; onCustomize?: () => void; kissDisabled?: boolean }) {
  const auth = useAuth();
  const coupleId = auth.pairing.coupleId;
  const userId = auth.session?.user.id;
  const positionWatch = useRef<Location.LocationSubscription | null>(null);
  const headingWatch = useRef<Location.LocationSubscription | null>(null);
  const latestPosition = useRef<Location.LocationObject | null>(null);
  const requested = useRef(false);
  const generation = useRef(0);
  const starting = useRef(false);
  const publishing = useRef<Promise<void>>(Promise.resolve());
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [partner, setPartner] = useState<PartnerLocation | null>(null);
  const [message, setMessage] = useState('');

  const refreshPartner = useCallback(async () => {
    if (!coupleId || !userId || AppState.currentState === 'background') return;
    try {
      const { data, error } = await requireSupabase().from('location_shares')
        .select('latitude,longitude,active,updated_at').eq('couple_id', coupleId).neq('user_id', userId).maybeSingle();
      if (error) throw error;
      const updatedAt = data ? Date.parse(data.updated_at) : NaN;
      setPartner(data && Number.isFinite(updatedAt) && Date.now() - updatedAt < 120000
        ? { latitude: data.latitude, longitude: data.longitude, active: data.active, coupleId, observerId: userId } : null);
    } catch { setPartner(null); }
  }, [coupleId, userId]);

  const pause = useCallback(() => {
    ++generation.current; starting.current = false;
    positionWatch.current?.remove(); positionWatch.current = null;
    headingWatch.current?.remove(); headingWatch.current = null;
    latestPosition.current = null;
    setActive(false); setBusy(false); setPosition(null); setHeading(null);
    // Complete an in-flight location write before marking this device offline.
    publishing.current = publishing.current.catch(() => {}).then(async () => {
      if (!coupleId) return;
      const { error } = await requireSupabase().rpc('stop_location', { expected_couple: coupleId });
      if (error) throw error;
    });
    void publishing.current.catch(() => { setMessage('Paylaşım durumu güncellenemedi. Bağlantını kontrol et.'); });
  }, [coupleId]);

  const publish = useCallback((next: Location.LocationObject, run: number) => {
    publishing.current = publishing.current.catch(() => {}).then(async () => {
      if (generation.current !== run || !requested.current || !coupleId) return;
      const { error } = await requireSupabase().rpc('update_location', {
        expected_couple: coupleId, lat: next.coords.latitude, lon: next.coords.longitude,
        direction: next.coords.heading, accuracy_m: next.coords.accuracy,
      });
      if (error) throw error;
      if (generation.current === run) { setActive(true); setMessage(''); }
    });
    return publishing.current;
  }, [coupleId]);

  const start = useCallback(async (askPermission: boolean) => {
    if (starting.current || positionWatch.current) return;
    if (!coupleId || !userId) { requested.current = false; setMessage('Önce partnerinle eşleşmelisin.'); return; }
    const run = ++generation.current;
    starting.current = true;
    setBusy(true); setMessage('');
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && askPermission) permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Yönünü paylaşmak için konum izni vermelisin.');
      if (!await Location.hasServicesEnabledAsync()) throw new Error('Telefonun konum servisini açmalısın.');
      if (generation.current !== run || !requested.current) return;
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (generation.current !== run || !requested.current) return;
      latestPosition.current = first; setPosition(first.coords);
      await publish(first, run);
      if (generation.current !== run) return;
      const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 2 }, next => {
        if (generation.current !== run) return;
        latestPosition.current = next; setPosition(next.coords);
        void publish(next, run).catch(() => { setActive(false); setMessage('Konum gönderilemedi. Bağlantını kontrol et.'); });
      });
      if (generation.current !== run) { subscription.remove(); return; }
      positionWatch.current = subscription;
      if (Platform.OS !== 'web') {
        try {
          const compass = await Location.watchHeadingAsync(next => {
            if (generation.current !== run) return;
            setHeading(next.accuracy > 0 ? (next.trueHeading >= 0 ? next.trueHeading : next.magHeading >= 0 ? next.magHeading : null) : null);
          });
          if (generation.current !== run) compass.remove();
          else headingWatch.current = compass;
        } catch { /* Devices without a compass show the bearing relative to north. */ }
      }
      await refreshPartner();
    } catch (error) {
      if (generation.current === run) {
        requested.current = false;
        pause();
        setMessage(error instanceof Error ? error.message : 'Konum paylaşımı başlatılamadı.');
      }
    } finally {
      if (generation.current === run) { starting.current = false; setBusy(false); }
    }
  }, [coupleId, userId, pause, publish, refreshPartner]);

  useEffect(() => {
    let mounted = true;
    const refresh = () => { if (mounted) void refreshPartner(); };
    refresh();
    const timer = setInterval(refresh, 5000);
    // The heartbeat keeps a stationary partner online as well.
    const heartbeat = setInterval(() => {
      if (latestPosition.current && requested.current && AppState.currentState !== 'background') {
        void publish(latestPosition.current, generation.current).catch(() => { setActive(false); setMessage('Konum gönderilemedi. Bağlantını kontrol et.'); });
      }
    }, 15000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background') pause();
      else if (state === 'active') {
        refresh();
        if (requested.current && !positionWatch.current) void start(false);
      }
    });
    return () => {
      mounted = false; requested.current = false;
      clearInterval(timer); clearInterval(heartbeat); listener.remove(); pause();
    };
  }, [refreshPartner, publish, pause, start]);

  function toggle() {
    if (busy) return;
    requested.current = !requested.current;
    if (requested.current) void start(true);
    else { setMessage(''); pause(); }
  }

  const partnerActive = Boolean(partner?.active && partner.coupleId === coupleId && partner.observerId === userId);
  const bothActive = active && partnerActive;
  const someoneActive = active || partnerActive;
  const direction = bothActive && position && partner ? partnerDirection(position, partner, heading) : null;
  const status = bothActive ? 'İkiniz de açıksınız' : active ? 'Partnerin bekleniyor' : partnerActive ? 'Partnerin hazır · Sen de aç' : 'Konum paylaşımı kapalı';

  return <View style={s.wrap}>
    <View style={s.controls}>{onCustomize && <Pressable accessibilityRole="button" accessibilityLabel="Ana ekran kartlarını düzenle" onPress={onCustomize} style={s.customize}><Icon name="SlidersHorizontal" size={18} color={theme.muted} /></Pressable>}{onKiss && <Pressable accessibilityRole="button" accessibilityLabel="Partnerine öpücük gönder" disabled={kissDisabled} onPress={onKiss} style={s.kiss}><AppText style={s.kissIcon}>💋</AppText></Pressable>}{onLetter && <Pressable accessibilityRole="button" accessibilityLabel="Mektup gönder" onPress={onLetter} style={s.letter}><Icon name="Send" size={17} color="#FFFFFF" /><AppText style={s.letterText}>Mektup</AppText></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Aşkım nerdesin?" accessibilityState={{ busy, selected: active }} accessibilityHint={active ? 'Konum paylaşımını durdurur' : 'Konum paylaşımını başlatır'} disabled={busy} onPress={toggle} style={[s.button, someoneActive && s.waiting, bothActive && s.together]}>
      {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="MapPin" size={17} color="#FFFFFF" />}
      <AppText style={s.label}>Aşkım nerdesin?</AppText>
    </Pressable></View>
    {direction ? <View style={s.partner}>
      <View accessibilityLabel={direction.rotation === null ? 'Yan yanasınız' : 'Partnerinin yönünü gösteren ok'} style={s.arrowCircle}>
        <View style={{ transform: [{ rotate: `${direction.rotation ?? 0}deg` }] }}><Icon name={direction.rotation === null ? 'MapPin' : 'ArrowUp'} size={32} color="#FFFFFF" strokeWidth={2.6} /></View>
      </View>
      <View style={s.partnerLabels}>
        <AppText style={s.partnerTitle}>{direction.rotation === null ? 'Yan yanasınız' : 'Partnerinin yönü'}</AppText>
        <AppText style={s.partnerText}>{direction.distance < 1000 ? `${Math.round(direction.distance)} m` : `${(direction.distance / 1000).toFixed(1)} km`}{direction.rotation !== null ? heading === null ? ' · Kuzeye göre' : ' · Telefonunu çevir' : ''}</AppText>
      </View>
    </View> : null}
    {message ? <AppText style={s.message}>{message}</AppText> : null}
  </View>;
}

const s = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 6, marginTop: 4, marginBottom: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  letter: { height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 12, backgroundColor: '#7D6658' },
  letterText: { color: '#FFFFFF', fontSize: 11, fontFamily: theme.bold, marginLeft: 6 },
  kiss: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEE0E5' },
  kissIcon: { fontSize: 21, lineHeight: 25 },
  customize: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8ECEF' },
  button: { width: 145, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#4B5561', borderRadius: 18, paddingHorizontal: 11, minHeight: 44 },
  waiting: { backgroundColor: '#2676C7' }, together: { backgroundColor: '#346C59' },
  label: { color: '#FFFFFF', fontSize: 11, fontFamily: theme.semibold },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#AEB8BE' }, dotActive: { backgroundColor: '#FFFFFF' },
  status: { color: theme.muted, fontSize: 10, marginRight: 3 },
  partner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: '#E2EDE7' },
  arrowCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#346C59' },
  partnerLabels: { gap: 4 }, partnerTitle: { color: theme.brand, fontSize: 12, fontFamily: theme.bold },
  partnerText: { color: theme.brand, fontSize: 10 }, message: { color: theme.danger, fontSize: 11, textAlign: 'right', maxWidth: '100%' },
});

import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { cloudError, requireSupabase, supabase, supabaseConfigured } from '../services/supabase';

export interface Invitation { id: string; code: string; status: string; expiresAt: string }
export interface PairingState { coupleId: string | null; relationshipDate: string; partnerName: string; invitation: Invitation | null }
interface AuthContextValue {
  configured: boolean; session: Session | null; loading: boolean; error: string | null; pairing: PairingState;
  recoveryMode: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<{ requiresEmailConfirmation: boolean }>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  createInvitation(): Promise<Invitation>;
  acceptInvitation(code: string): Promise<void>;
  rejectInvitation(code: string): Promise<void>;
  cancelInvitation(): Promise<void>;
  leaveCouple(): Promise<void>;
}

const emptyPairing: PairingState = { coupleId: null, relationshipDate: '', partnerName: '', invitation: null };
const AuthContext = createContext<AuthContextValue | null>(null);

export function getAuthRedirectUrl(queryParams?: Record<string, string>): string {
  const configured = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    for (const [key, value] of Object.entries(queryParams ?? {})) url.searchParams.set(key, value);
    return url.toString();
  }
  return Linking.createURL('/auth', { queryParams });
}

function invitationFromRow(row: { id: string; code: string; status: string; expires_at: string }): Invitation {
  return { id: row.id, code: row.code, status: row.status, expiresAt: row.expires_at };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(supabaseConfigured);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingState>(emptyPairing);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const requestGeneration = useRef(0);
  const loadedPairingFor = useRef<string | null>(null);
  const sessionUserId = useRef<string | null>(null);
  const userId = session?.user.id;

  const refresh = useCallback(async () => {
    if ((userId || null) !== sessionUserId.current) return;
    const generation = ++requestGeneration.current;
    if (!userId || !supabase) { loadedPairingFor.current = null; setPairing(emptyPairing); setPairingLoading(false); return; }
    if (loadedPairingFor.current !== userId) setPairingLoading(true);
    try {
      const [membership, invitation] = await Promise.all([
        supabase.from('couple_members').select('couple_id').eq('user_id', userId).maybeSingle(),
        supabase.from('invitations').select('id,code,status,expires_at').eq('inviter_id', userId).eq('status', 'pending')
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (membership.error) throw membership.error;
      if (invitation.error) throw invitation.error;
      const next: PairingState = { ...emptyPairing, invitation: invitation.data ? invitationFromRow(invitation.data) : null };
      if (membership.data) {
        next.coupleId = membership.data.couple_id;
        const [couple, partnerMembership] = await Promise.all([
          supabase.from('couples').select('relationship_date').eq('id', next.coupleId).single(),
          supabase.from('couple_members').select('user_id').eq('couple_id', next.coupleId).neq('user_id', userId).maybeSingle(),
        ]);
        if (couple.error) throw couple.error;
        if (partnerMembership.error) throw partnerMembership.error;
        next.relationshipDate = couple.data.relationship_date || '';
        if (partnerMembership.data) {
          const partner = await supabase.from('profiles').select('display_name,full_name').eq('id', partnerMembership.data.user_id).single();
          if (partner.error) throw partner.error;
          next.partnerName = partner.data.display_name || partner.data.full_name || '';
        }
      }
      if (generation === requestGeneration.current) { setPairing(next); setError(null); }
    } catch (caught) {
      const failure = cloudError(caught);
      if (generation === requestGeneration.current) setError(failure.message);
      throw failure;
    } finally {
      if (generation === requestGeneration.current) { loadedPairingFor.current = userId; setPairingLoading(false); }
    }
  }, [userId]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEventGeneration = 0;
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id || null;
      if (sessionUserId.current !== nextUserId) {
        ++requestGeneration.current;
        loadedPairingFor.current = null;
        sessionUserId.current = nextUserId;
        setPairing(emptyPairing);
        setPairingLoading(Boolean(nextUserId));
        setRecoveryMode(false);
      }
      setSession(nextSession);
      setSessionLoading(false);
    };
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || authEventGeneration > 0) return;
      if (sessionError) setError(cloudError(sessionError).message);
      else applySession(data.session);
      setSessionLoading(false);
    }).catch(caught => { if (active && authEventGeneration === 0) { setError(cloudError(caught).message); setSessionLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      ++authEventGeneration;
      applySession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (!nextSession) { ++requestGeneration.current; setPairing(emptyPairing); setRecoveryMode(false); }
    });
    const invalidatePendingPairing = () => { ++requestGeneration.current; };
    return () => { active = false; data.subscription.unsubscribe(); invalidatePendingPairing(); };
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh).catch(() => { /* refresh owns the visible error state */ });
    if (!userId || !supabase) return;
    const channel = supabase.channel(`ikimiz-pairing-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'couple_members', filter: `user_id=eq.${userId}` }, () => { void refresh().catch(() => {}); })
      // Membership DELETE payloads are not trusted/filterable beyond their PK.
      // Refresh our own membership instead of consuming a deletion payload.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'couple_members' }, () => { void refresh().catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `inviter_id=eq.${userId}` }, () => { void refresh().catch(() => {}); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => { void refresh().catch(() => {}); })
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh().catch(() => {}); });
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') { supabase?.auth.startAutoRefresh(); void refresh().catch(() => {}); }
      else if (Platform.OS !== 'web') supabase?.auth.stopAutoRefresh();
    });
    return () => { listener.remove(); void supabase?.removeChannel(channel); };
  }, [refresh, userId]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    async function handleUrl(url: string) {
      try {
        const parsed = new URL(url);
        const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const code = parsed.searchParams.get('code');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const isRecovery = params.get('type') === 'recovery' || parsed.searchParams.get('recovery') === '1';
        if (params.get('error') || parsed.searchParams.get('error')) throw new Error('recovery_expired');
        if (!code && !(accessToken && refreshToken)) return;
        const result = code ? await requireSupabase().auth.exchangeCodeForSession(code)
          : await requireSupabase().auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
        if (result.error) throw result.error;
        if (active && isRecovery) setRecoveryMode(true);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          parsed.hash = '';
          parsed.searchParams.delete('code');
          parsed.searchParams.delete('recovery');
          window.history.replaceState({}, '', parsed.pathname + parsed.search);
        }
      } catch {
        if (active) setError('Bağlantı geçersiz veya süresi dolmuş. Yeni bir e-posta bağlantısı iste.');
      }
    }
    void Linking.getInitialURL().then(url => { if (url && active) void handleUrl(url); });
    const listener = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
    return () => { active = false; listener.remove(); };
  }, []);

  async function signIn(email: string, password: string) {
    const { error: failure } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (failure) throw cloudError(failure);
    setError(null);
  }
  async function signUp(email: string, password: string, name: string) {
    if (!name.trim() || name.trim().length > 80) throw new Error('Adın 1–80 karakter arasında olmalı.');
    if (password.length < 8) throw new Error('Parolan en az 8 karakter olmalı.');
    const { data, error: failure } = await requireSupabase().auth.signUp({ email: email.trim(), password,
      options: { data: { full_name: name.trim(), display_name: name.trim() }, emailRedirectTo: getAuthRedirectUrl() } });
    if (failure) throw cloudError(failure);
    return { requiresEmailConfirmation: !data.session };
  }
  async function resetPassword(email: string) {
    const { error: failure } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAuthRedirectUrl({ recovery: '1' }),
    });
    if (failure) throw cloudError(failure);
  }
  async function updatePassword(password: string) {
    if (password.length < 8) throw new Error('Parolan en az 8 karakter olmalı.');
    const { error: failure } = await requireSupabase().auth.updateUser({ password });
    if (failure) throw cloudError(failure);
    setRecoveryMode(false);
  }
  async function signOut() {
    const { error: failure } = await requireSupabase().auth.signOut();
    if (failure) throw cloudError(failure);
    setError(null);
  }
  async function createInvitation() {
    const requestedFor = userId;
    const { data, error: failure } = await requireSupabase().rpc('create_invitation').single();
    if (failure) throw cloudError(failure);
    if (sessionUserId.current !== requestedFor) throw new Error('Oturum değişti. Güncel hesabında yeniden dene.');
    const invitation = invitationFromRow(data as { id: string; code: string; status: string; expires_at: string });
    setPairing(previous => ({ ...previous, invitation }));
    return invitation;
  }
  async function acceptInvitation(code: string) {
    const requestedFor = userId;
    if (!/^[A-Z0-9]{6}$/.test(code.trim().toUpperCase())) throw new Error('Davet kodu 6 harf veya rakamdan oluşmalı.');
    const { error: failure } = await requireSupabase().rpc('accept_invitation', { invite_code: code.trim().toUpperCase() });
    if (failure) throw cloudError(failure);
    if (sessionUserId.current !== requestedFor) throw new Error('Oturum değişti. Güncel hesabında yeniden dene.');
    await refresh();
  }
  async function rejectInvitation(code: string) {
    const requestedFor = userId;
    const { error: failure } = await requireSupabase().rpc('reject_invitation', { invite_code: code.trim().toUpperCase() });
    if (failure) throw cloudError(failure);
    if (sessionUserId.current !== requestedFor) throw new Error('Oturum değişti. Güncel hesabında yeniden dene.');
    await refresh();
  }
  async function cancelInvitation() {
    const requestedFor = userId;
    if (!pairing.invitation) return;
    const { error: failure } = await requireSupabase().rpc('cancel_invitation', { invitation_id: pairing.invitation.id });
    if (failure) throw cloudError(failure);
    if (sessionUserId.current !== requestedFor) throw new Error('Oturum değişti. Güncel hesabında yeniden dene.');
    await refresh();
  }
  async function leaveCouple() {
    const requestedFor = userId;
    const { error: failure } = await requireSupabase().rpc('leave_couple');
    if (failure) throw cloudError(failure);
    if (sessionUserId.current !== requestedFor) throw new Error('Oturum değişti. Güncel hesabında yeniden dene.');
    await refresh();
  }

  return <AuthContext.Provider value={{ configured: supabaseConfigured, session,
    loading: sessionLoading || pairingLoading, error, pairing, recoveryMode,
    signIn, signUp, resetPassword, updatePassword, signOut, refresh,
    createInvitation, acceptInvitation, rejectInvitation, cancelInvitation, leaveCouple }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  return context;
}

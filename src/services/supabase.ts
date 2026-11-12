import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const validUrl = projectUrl && /^https?:\/\/[^\s]+$/.test(projectUrl);

function isPublicClientKey(key: string | undefined): boolean {
  if (!key || key.startsWith('sb_secret_')) return false;
  if (key.startsWith('sb_publishable_')) return true;
  // Older Supabase public keys are JWTs. Reject service-role JWTs even when
  // someone accidentally places one in the public-key setting.
  try {
    const part = key.split('.')[1];
    if (!part) return false;
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return claims.role === 'anon';
  } catch { return false; }
}

// Only an anonymous/publishable key belongs in an Expo client. Never supply a
// service-role key or an sb_secret_ key to EXPO_PUBLIC_* variables.
export const supabaseConfigured = Boolean(validUrl && isPublicClientKey(publicKey));

const storage = {
  getItem: (key: string) => Platform.OS === 'web' && typeof window === 'undefined'
    ? Promise.resolve(null) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => Platform.OS === 'web' && typeof window === 'undefined'
    ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) => Platform.OS === 'web' && typeof window === 'undefined'
    ? Promise.resolve() : AsyncStorage.removeItem(key),
};

export const supabase = supabaseConfigured
  ? createClient(projectUrl!, publicKey!, {
    auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
  })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Ortak alan için Supabase bağlantısı henüz yapılandırılmadı. Yerel deneme alanını kullanabilirsin.');
  return supabase;
}

export function cloudError(error: unknown, fallback = 'İşlem tamamlanamadı. Bağlantını kontrol edip yeniden dene.'): Error {
  const message = error instanceof Error ? error.message : (error && typeof error === 'object' && 'message' in error ? String(error.message) : '');
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '40001' || /version_conflict|conflict|stale/i.test(message)) return new Error('Bu kayıt partnerin tarafından değiştirildi. Ekranı yenileyip yeniden dene.');
  if (/not_paired|not_a_member|active_couple_required|no_active_couple/i.test(message)) return new Error('Ortak kayıtlar için önce partnerinle eşleşmelisin.');
  if (/invite_expired/i.test(message)) return new Error('Davetin süresi dolmuş. Yeni bir davet kodu oluşturun.');
  if (/invite_not_found|invalid_invite/i.test(message)) return new Error('Bu davet kodu bulunamadı veya artık geçerli değil.');
  if (/already_paired/i.test(message)) return new Error('Bu hesap zaten bir partnerle eşleşmiş.');
  if (/cannot_invite_self|self_invite/i.test(message)) return new Error('Kendi davet kodunu kabul edemezsin.');
  if (/Invalid login credentials/i.test(message)) return new Error('E-posta veya parola doğru değil.');
  if (/Email not confirmed/i.test(message)) return new Error('Giriş yapmadan önce e-postandaki doğrulama bağlantısını aç.');
  if (/User already registered/i.test(message)) return new Error('Bu e-posta ile daha önce hesap oluşturulmuş.');
  if (/rate limit|too many requests/i.test(message)) return new Error('Çok sık deneme yapıldı. Biraz sonra yeniden dene.');
  if (/relation .* does not exist|schema cache|Could not find the table|Could not find the function/i.test(message)) return new Error('Ortak alan veritabanı kurulumu tamamlanmamış. Supabase kurulum adımlarını kontrol edin.');
  if (/row-level security|permission denied/i.test(message)) return new Error('Bu ortak alana erişimin yok. Eşleşme durumunu kontrol et.');
  if (code === '42501') return new Error('Bu ortak alana erişimin yok. Eşleşme durumunu kontrol et.');
  if (code === '28000') return new Error('Bu işlem için önce hesabına giriş yapmalısın.');
  if (/daily_record_exists|duplicate key/i.test(message)) return new Error('Bu gün için zaten bir kayıt var. Var olan kaydı düzenle.');
  // These are deliberate validation/business messages raised by our SQL RPCs.
  if (['22023', 'P0001', '23505'].includes(code) && message && !/^[a-z_]+$/.test(message)) return new Error(message);
  return new Error(fallback);
}

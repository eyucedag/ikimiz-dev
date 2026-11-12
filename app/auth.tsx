import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Button, Field, Gradient, Icon, Screen } from '../src/components/ui';
import { theme } from '../src/constants/theme';
import { useAuth } from '../src/hooks/useAuth';

type AuthMode = 'sign-in' | 'sign-up' | 'reset' | 'recovery';

export default function AuthScreen() {
  const auth = useAuth();
  const [requestedMode, setRequestedMode] = useState<AuthMode>('sign-in');
  const mode = auth.recoveryMode ? 'recovery' : requestedMode;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function switchMode(next: AuthMode) {
    setRequestedMode(next);
    setPassword('');
    setError('');
    setMessage('');
  }

  async function submit() {
    setError('');
    setMessage('');
    if (mode !== 'recovery' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Geçerli bir e-posta adresi ekle.');
      return;
    }
    if (mode === 'sign-up' && !name.trim()) {
      setError('Sana nasıl seslenelim? Adını ekle.');
      return;
    }
    if (mode !== 'reset' && !password) {
      setError('Parolanı ekle.');
      return;
    }
    if ((mode === 'sign-up' || mode === 'recovery') && password.length < 8) {
      setError('En az 8 karakterli bir parola seç.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await auth.signIn(email.trim(), password);
        router.replace('/(tabs)/settings');
      } else if (mode === 'sign-up') {
        const result = await auth.signUp(email.trim(), password, name.trim());
        if (result.requiresEmailConfirmation) {
          setMessage('Hesabını doğrulamak için e-postana gönderdiğimiz bağlantıyı aç. Ardından buradan giriş yapabilirsin.');
          setRequestedMode('sign-in');
          setPassword('');
        } else {
          router.replace('/(tabs)/settings');
        }
      } else if (mode === 'reset') {
        await auth.resetPassword(email.trim());
        setMessage('Bu adrese bağlı bir hesap varsa parola yenileme bağlantısı gönderildi. E-postanı kontrol edebilirsin.');
      } else {
        await auth.updatePassword(password);
        setPassword('');
        router.replace('/(tabs)/settings');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem tamamlanamadı. Yeniden deneyebilirsin.');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'sign-up' ? 'Hikâyeniz burada başlasın' : mode === 'reset' ? 'Yeniden buluşalım' : mode === 'recovery' ? 'Yeni parolanı belirle' : 'Yuvana hoş geldin';
  const subtitle = mode === 'sign-up' ? 'Bir hesap aç, partnerini davet et. Güzel günleri birlikte biriktirin.' : mode === 'reset' ? 'E-posta adresine parola yenileme bağlantısı gönderelim.' : mode === 'recovery' ? 'Yuvana güvenle dönebilmek için yeni bir parola seç.' : 'Birlikte planladığınız, paylaştığınız ve biriktirdiğiniz her şey.';
  const submitLabel = mode === 'sign-up' ? 'Hesap oluştur' : mode === 'reset' ? 'Yenileme bağlantısı gönder' : mode === 'recovery' ? 'Yeni parolayı kaydet' : 'Giriş yap';

  return (
    <Screen>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.back}>
          <Icon name="ArrowLeft" size={23} color={theme.text} />
        </Pressable>

        <View style={styles.brand}>
          <Gradient colors={['#638C89', '#3E6465']} style={styles.brandIcon}><Icon name="House" size={35} color="#FFFFFF" /><View style={styles.heart}><Icon name="Heart" size={14} color="#AA6278" /></View></Gradient>
          <AppText style={styles.brandName}>ikimiz</AppText>
          <AppText style={styles.brandCaption}>birlikte güzel</AppText>
        </View>

        <View style={styles.panel}>
          <AppText style={styles.title}>{auth.configured ? title : 'Ortak yuvanıza hazırlanıyoruz'}</AppText>
          <AppText style={styles.subtitle}>{auth.configured ? subtitle : 'Hesap bağlantısı bu sürümde henüz etkinleştirilmedi. Bu sırada İkimiz’i bu cihazdaki deneme alanında keşfedebilirsin.'}</AppText>
          {auth.configured ? (
            <>
              {mode === 'sign-in' || mode === 'sign-up' ? <View style={styles.tabs}>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'sign-in' }} aria-selected={mode === 'sign-in'} onPress={() => switchMode('sign-in')} style={[styles.tab, mode === 'sign-in' && styles.tabSelected]}><AppText style={[styles.tabText, mode === 'sign-in' && styles.tabTextSelected]}>Giriş yap</AppText></Pressable>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'sign-up' }} aria-selected={mode === 'sign-up'} onPress={() => switchMode('sign-up')} style={[styles.tab, mode === 'sign-up' && styles.tabSelected]}><AppText style={[styles.tabText, mode === 'sign-up' && styles.tabTextSelected]}>Hesap oluştur</AppText></Pressable>
              </View> : null}
              {mode === 'sign-up' ? <Field label="Adın" value={name} onChangeText={setName} placeholder="Sana nasıl seslenelim?" autoComplete="given-name" maxLength={80} /> : null}
              {mode !== 'recovery' ? <Field label="E-posta" value={email} onChangeText={setEmail} placeholder="sen@ornek.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} /> : null}
              {mode !== 'reset' ? <View style={{ gap: 7 }}>
                <Field label={mode === 'recovery' ? 'Yeni parola' : 'Parola'} value={password} onChangeText={setPassword} placeholder={mode === 'sign-in' ? 'Parolan' : 'En az 8 karakter'} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Parolayı gizle' : 'Parolayı göster'} onPress={() => setShowPassword(value => !value)} style={styles.passwordToggle}><Icon name={showPassword ? 'EyeOff' : 'Eye'} color={theme.muted} size={15} /><AppText style={styles.smallLink}>{showPassword ? 'Parolayı gizle' : 'Parolayı göster'}</AppText></Pressable>
              </View> : null}
              {mode === 'sign-in' ? <Pressable accessibilityRole="button" onPress={() => switchMode('reset')} style={styles.forgot}><AppText style={styles.link}>Parolamı unuttum</AppText></Pressable> : null}
              {error || auth.error ? <AppText accessibilityRole="alert" style={styles.error}>{error || auth.error}</AppText> : null}
              {message ? <View accessibilityLiveRegion="polite" style={styles.message}><Icon name="Check" color={theme.brand} size={18} /><AppText style={styles.messageText}>{message}</AppText></View> : null}
              <Button label={submitLabel} icon={mode === 'reset' ? 'Mail' : 'ArrowRight'} loading={busy || auth.loading} onPress={() => void submit()} />
              {mode === 'reset' ? <Button label="Girişe dön" onPress={() => switchMode('sign-in')} secondary /> : null}
            </>
          ) : <View style={styles.previewInfo}><Icon name="Heart" color={theme.brand} size={24} /><AppText style={styles.previewText}>Takvimini oluştur, bir not bırak, bugünün şarkısını seç. Deneme alanındaki kayıtların bu cihazda kalır.</AppText></View>}
        </View>

        {mode !== 'recovery' ? <Button label="Deneme alanına dön" onPress={() => router.replace('/(tabs)')} secondary /> : null}
        <View style={styles.privacy}><Icon name="ShieldCheck" size={16} color={theme.brand} /><AppText style={styles.privacyText}>İkinize ait bir alan.{`\n`}Ortak içeriklerde eşit söz hakkı.</AppText></View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 490, alignSelf: 'center', paddingBottom: 40, gap: 22 },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  brand: { alignItems: 'center', paddingTop: 2, paddingBottom: 10 },
  brandIcon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heart: { position: 'absolute', right: 12, bottom: 10, width: 25, height: 25, borderRadius: 10, backgroundColor: '#F4E4ED', alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 38, fontFamily: theme.extrabold, letterSpacing: -2, color: theme.brandDark },
  brandCaption: { fontSize: 11, color: theme.muted, letterSpacing: 1.5, marginTop: 2 },
  panel: { backgroundColor: theme.surface, borderRadius: 27, padding: 24, gap: 19, borderWidth: 1, borderColor: theme.border },
  title: { fontFamily: theme.extrabold, fontSize: 25, lineHeight: 34, letterSpacing: -0.9 },
  subtitle: { fontSize: 12, color: theme.muted, lineHeight: 22, marginTop: -8 },
  tabs: { flexDirection: 'row', backgroundColor: '#E9EEF0', padding: 4, borderRadius: 13, marginBottom: 3 },
  tab: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  tabSelected: { backgroundColor: theme.surface, boxShadow: '0px 2px 5px rgba(23,36,59,0.05)' },
  tabText: { fontSize: 12, color: theme.muted, fontFamily: theme.semibold },
  tabTextSelected: { color: theme.brandDark },
  passwordToggle: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-end', paddingVertical: 3 },
  smallLink: { fontSize: 10, color: theme.muted },
  forgot: { alignSelf: 'flex-end', marginTop: -6, paddingVertical: 4 },
  link: { fontSize: 11, fontFamily: theme.semibold, color: theme.brand },
  error: { fontSize: 12, lineHeight: 20, color: theme.danger },
  message: { backgroundColor: theme.brandLight, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  messageText: { flex: 1, fontSize: 12, lineHeight: 21, color: theme.brandDark },
  previewInfo: { backgroundColor: theme.brandLight, borderRadius: 18, padding: 18, gap: 12 },
  previewText: { fontSize: 12, color: theme.brandDark, lineHeight: 22 },
  privacy: { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  privacyText: { color: theme.muted, textAlign: 'center', fontSize: 10, lineHeight: 19 },
});

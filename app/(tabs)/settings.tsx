import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Button, Field, Gradient, Icon, Screen } from '../../src/components/ui';
import { PairingPanel } from '../../src/components/PairingPanel';
import { theme } from '../../src/constants/theme';
import { useApp } from '../../src/hooks/useApp';
import { useAuth } from '../../src/hooks/useAuth';

export default function SettingsScreen() {
  const { mode, userId } = useApp();
  return <SettingsContent key={`${mode}:${userId}`} />;
}

function SettingsContent() {
  const { profile, mode, ready, updateProfile } = useApp();
  const auth = useAuth();
  const [nameDraft, setNameDraft] = useState<string>();
  const [partnerNameDraft, setPartnerNameDraft] = useState<string>();
  const [relationshipDateDraft, setRelationshipDateDraft] = useState<string>();
  const name = nameDraft ?? profile.name;
  const partnerName = partnerNameDraft ?? profile.partnerName;
  const relationshipDate = relationshipDateDraft ?? profile.relationshipDate;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  async function saveProfile() {
    setError('');
    setMessage('');
    if (!name.trim()) {
      setError('Sana nasıl seslenelim? Adını ekle.');
      return;
    }
    if (relationshipDate) {
      const parsed = new Date(`${relationshipDate}T12:00:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(relationshipDate) || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(relationshipDate.slice(0, 4)) || parsed.getMonth() + 1 !== Number(relationshipDate.slice(5, 7)) || parsed.getDate() !== Number(relationshipDate.slice(8, 10))) {
        setError('Tarihi yıl-ay-gün şeklinde gir. Örneğin 2024-05-20.');
        return;
      }
      if (parsed > new Date(new Date().setHours(23, 59, 59, 999))) {
        setError('İlişki başlangıcı gelecekte olamaz.');
        return;
      }
    }
    setBusy(true);
    try {
      await updateProfile({ name: name.trim(), ...(mode === 'local' ? { partnerName: partnerName.trim() } : {}), ...(mode === 'local' || auth.pairing.coupleId ? { relationshipDate } : {}) });
      setNameDraft(undefined);
      setPartnerNameDraft(undefined);
      setRelationshipDateDraft(undefined);
      setMessage('Bilgilerin kaydedildi.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bilgiler kaydedilemedi. Yeniden deneyebilirsin.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await auth.signOut();
      setConfirmSignOut(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Oturum kapatılamadı.');
    } finally {
      setBusy(false);
    }
  }

  const initials = name.trim().slice(0, 1).toLocaleUpperCase('tr-TR') || 'S';
  return (
    <Screen>
      <View style={styles.content}>
        <View>
          <AppText style={styles.eyebrow}>KENDİNİZ GİBİ BİR ALAN</AppText>
          <AppText style={styles.title}>Ayarlar</AppText>
        </View>

        <Gradient colors={['#3E6465', '#284F50']} style={styles.hero}>
          <View style={styles.avatar}><AppText style={styles.initial}>{initials}</AppText></View>
          <View style={styles.heroText}>
            <AppText style={styles.heroTitle}>{profile.name || 'Senin küçük yuvan'}</AppText>
            <AppText style={styles.heroSubtitle}>{mode === 'cloud' ? 'Ortak yaşam, iki kişilik bir hikâye.' : 'Güzel bir başlangıç için her şey burada.'}</AppText>
          </View>
          <Icon name="Heart" color="#C2D7D2" size={25} />
        </Gradient>

        <View style={styles.section}>
          <View style={styles.sectionHeading}><Icon name="UserRound" color={theme.brand} size={20} /><AppText style={styles.sectionTitle}>Sizi tanıyalım</AppText></View>
          <Field label="Adın" value={name} onChangeText={setNameDraft} placeholder="Sana nasıl seslenelim?" autoComplete="given-name" maxLength={80} />
          {mode === 'local' ? <Field label="Partnerinin adı" value={partnerName} onChangeText={setPartnerNameDraft} placeholder="Partnerinin adı" maxLength={80} /> : profile.partnerName ? <View style={styles.partnerDetail}><AppText style={styles.fieldLabel}>Partnerin</AppText><AppText style={styles.partnerName}>{profile.partnerName}</AppText></View> : null}
          {mode === 'local' || auth.pairing.coupleId ? <View style={{ gap: 7 }}>
            <Field label="İlişki başlangıcı" value={relationshipDate} onChangeText={setRelationshipDateDraft} placeholder="2024-05-20" autoCapitalize="none" maxLength={10} keyboardType="numbers-and-punctuation" />
            <AppText style={styles.hint}>Yıl-ay-gün şeklinde. Birlikte geçen zaman bu tarihten hesaplanır.</AppText>
          </View> : <AppText style={styles.hint}>İlişki başlangıcınızı partnerinle eşleştikten sonra ekleyebilirsiniz.</AppText>}
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
          {message ? <View accessibilityLiveRegion="polite" style={styles.success}><Icon name="Check" color={theme.brand} size={17} /><AppText style={styles.successText}>{message}</AppText></View> : null}
          <Button label="Bilgileri kaydet" icon="Check" loading={busy} disabled={!ready} onPress={() => void saveProfile()} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}><Icon name="Heart" color={theme.brand} size={20} /><AppText style={styles.sectionTitle}>İki kişilik alanınız</AppText></View>
          {auth.session ? <PairingPanel /> : <>
            <AppText style={styles.body}>Partnerinle eşleşerek planlarınızı, notlarınızı ve anılarınızı aynı yerde biriktirin.</AppText>
            <View style={styles.localBadge}><View style={styles.localDot} /><AppText style={styles.localText}>Bu cihazdaki deneme alanı</AppText></View>
            <AppText style={styles.hint}>Buradaki kayıtlar bu cihazda saklanır. Partnerinle paylaşım için hesabınla giriş yapman gerekir.</AppText>
            <Button label={auth.configured ? 'Hesabını bağla' : 'Hesap ve ortak alan'} onPress={() => router.push('/auth')} icon="Link" secondary />
          </>}
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/customize')} style={({ pressed }) => [styles.customize, pressed && { opacity: 0.75 }]}>
          <View style={styles.preferenceIcon}><Icon name="Palette" size={25} color={theme.brand} /></View>
          <View style={{ flex: 1 }}><AppText style={styles.preferenceTitle}>Bugün senin gibi olsun</AppText><AppText style={styles.hint}>Kartların sırasını ve görünürlüğünü düzenle.</AppText></View>
          <Icon name="ChevronRight" color={theme.brand} size={21} />
        </Pressable>

        <View style={styles.privacy}><Icon name="ShieldCheck" size={19} color={theme.brand} /><AppText style={styles.privacyText}>{mode === 'cloud' ? 'Ortak kayıtlarınız yalnızca çift alanınızda görünür. İkiniz de aynı düzenleme ve silme haklarına sahipsiniz.' : 'Deneme alanındaki değişikliklerin bu cihazda kalır. Hesap bağlantısı kurulana kadar ortak paylaşım yapılmaz.'}</AppText></View>
        {auth.session ? <Button label="Oturumu kapat" icon="LogOut" secondary onPress={() => setConfirmSignOut(true)} /> : null}
        <AppText style={styles.footer}>ikimiz · birlikte güzel{`\n`}Sürüm 0.1.0</AppText>
      </View>

      <Modal visible={confirmSignOut} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmSignOut(false); }}>
        <View style={styles.backdrop}><View style={styles.dialog}>
          <Icon name="LogOut" color={theme.brand} size={28} />
          <AppText style={styles.dialogTitle}>Oturumunu kapatalım mı?</AppText>
          <AppText style={styles.body}>Ortak kayıtlarınız hesabınızda kalır. Bu cihazda yeniden giriş yapabilirsin.</AppText>
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
          <Button label="Oturumu kapat" onPress={() => void signOut()} loading={busy} />
          <Button label="Vazgeç" onPress={() => setConfirmSignOut(false)} secondary disabled={busy} />
        </View></View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 40, gap: 24 },
  eyebrow: { fontFamily: theme.bold, fontSize: 10, color: theme.brand, letterSpacing: 2, marginBottom: 7 },
  title: { fontFamily: theme.extrabold, fontSize: 32, letterSpacing: -1.2 },
  hero: { borderRadius: 26, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 55, height: 55, borderRadius: 20, backgroundColor: '#D9E6E2', alignItems: 'center', justifyContent: 'center' },
  initial: { color: theme.brandDark, fontSize: 24, fontFamily: theme.extrabold },
  heroText: { flex: 1 },
  heroTitle: { color: theme.white, fontFamily: theme.bold, fontSize: 19, marginBottom: 5 },
  heroSubtitle: { color: '#DAE5E3', fontSize: 12, lineHeight: 20 },
  section: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 24, padding: 22, gap: 18 },
  sectionHeading: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 2 },
  sectionTitle: { fontSize: 17, fontFamily: theme.bold, letterSpacing: -0.35, flex: 1 },
  hint: { fontSize: 11, color: theme.muted, lineHeight: 19 },
  body: { fontSize: 13, color: theme.muted, lineHeight: 23 },
  error: { fontSize: 12, color: theme.danger, lineHeight: 20 },
  success: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  successText: { fontSize: 12, color: theme.brand },
  fieldLabel: { fontSize: 12, color: theme.muted, marginBottom: 7 },
  partnerDetail: { paddingVertical: 5 },
  partnerName: { fontFamily: theme.semibold, fontSize: 15 },
  localBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: theme.brandLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  localDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.brand },
  localText: { fontSize: 10, fontFamily: theme.semibold, color: theme.brandDark },
  customize: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, backgroundColor: theme.surface, padding: 20, borderWidth: 1, borderColor: theme.border },
  preferenceIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: theme.brandLight, alignItems: 'center', justifyContent: 'center' },
  preferenceTitle: { fontSize: 14, fontFamily: theme.bold, marginBottom: 5 },
  privacy: { paddingHorizontal: 6, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  privacyText: { flex: 1, fontSize: 11, color: theme.muted, lineHeight: 19 },
  footer: { textAlign: 'center', fontSize: 11, lineHeight: 21, color: theme.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(23,36,59,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: theme.surface, borderRadius: 28, padding: 26, gap: 18 },
  dialogTitle: { fontSize: 22, fontFamily: theme.bold, letterSpacing: -0.7 },
});

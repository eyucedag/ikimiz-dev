import React, { useEffect, useState } from 'react';
import { Modal, Platform, Share, StyleSheet, View } from 'react-native';
import { AppText, Button, Field, Icon } from './ui';
import { theme } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';

export function PairingPanel() {
  const auth = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const invitation = auth.pairing.invitation;
  const expiresAt = invitation?.expiresAt;
  const expired = invitation ? new Date(invitation.expiresAt).getTime() <= now : false;

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem tamamlanamadı. Yeniden deneyebilirsin.');
    } finally {
      setBusy(false);
    }
  }

  async function shareCode() {
    if (!invitation) return;
    try {
      await Share.share({ title: 'İkimiz’e davetlisin', message: `İkimiz’de ortak yuvamızı oluşturalım. Davet kodum: ${invitation.code}` });
    } catch {
      setError('Paylaşım açılamadı. Kodu seçip kopyalayarak partnerine gönderebilirsin.');
    }
  }

  const validCode = /^[A-Z0-9]{6}$/.test(code.trim());
  return (
    <View style={styles.container}>
      {auth.pairing.coupleId ? (
        <>
          <View style={styles.paired}>
            <View style={styles.pairedIcon}><Icon name="Heart" color={theme.brand} size={23} /></View>
            <View style={{ flex: 1 }}><AppText style={styles.heading}>Artık aynı yuvadasınız</AppText><AppText style={styles.body}>{auth.pairing.partnerName ? `${auth.pairing.partnerName} ile eşleştin.` : 'Partnerinle eşleştin.'}</AppText></View>
          </View>
          <AppText style={styles.body}>Ortak kayıtlarınızı ikiniz de görüntüleyebilir, düzenleyebilir ve silebilirsiniz.</AppText>
          <Button label="Eşleşmeyi sonlandır" onPress={() => setConfirmLeave(true)} icon="Unlink" secondary disabled={busy} />
        </>
      ) : (
        <>
          <AppText style={styles.body}>Biriniz davet kodu oluştursun, diğeriniz bu kodla katılsın. Sonrası ikinizin.</AppText>
          {invitation?.status === 'pending' && !expired ? (
            <View style={styles.invitation}>
              <AppText style={styles.codeLabel}>PARTNERİNE GÖNDERECEĞİN KOD</AppText>
              <AppText selectable accessibilityLabel={`Davet kodu ${invitation.code}`} style={styles.code}>{invitation.code}</AppText>
              <AppText style={styles.expiry}>Son kullanım: {new Date(invitation.expiresAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</AppText>
              <AppText style={styles.small}>Kodu seçip kopyalayabilirsin. Eşleşme partnerin daveti kabul ettiğinde tamamlanır.</AppText>
              {Platform.OS !== 'web' ? <Button label="Davet kodunu paylaş" onPress={() => void shareCode()} icon="Share2" disabled={busy} /> : null}
              <Button label="Daveti iptal et" onPress={() => void run(auth.cancelInvitation, 'Davet iptal edildi.')} secondary disabled={busy} />
            </View>
          ) : (
            <>
              {expired ? <AppText style={styles.small}>Önceki davetin süresi doldu. Yeni bir kod oluşturabilirsin.</AppText> : null}
              <Button label="Davet kodu oluştur" icon="Link" onPress={() => void run(auth.createInvitation, 'Davetin hazır. Kodunu partnerinle paylaş.')} loading={busy} />
            </>
          )}

          <View style={styles.divider}><View style={styles.line} /><AppText style={styles.or}>veya bir davete katıl</AppText><View style={styles.line} /></View>
          <Field label="Partnerinin davet kodu" value={code} onChangeText={value => { setCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)); setError(''); }} placeholder="6 karakterlik kod" maxLength={6} autoCapitalize="characters" autoCorrect={false} />
          <Button label="Daveti kabul et" icon="Heart" onPress={() => void run(() => auth.acceptInvitation(code.trim()), 'Partnerinle eşleştin. Ortak alanınız hazır.')} secondary disabled={!validCode || busy} />
          {validCode ? <Button label="Bu daveti reddet" onPress={() => void run(() => auth.rejectInvitation(code.trim()), 'Davet reddedildi.')} secondary disabled={busy} /> : null}
        </>
      )}
      {error || auth.error ? <AppText accessibilityRole="alert" style={styles.error}>{error || auth.error}</AppText> : null}
      {message ? <AppText accessibilityLiveRegion="polite" style={styles.success}>{message}</AppText> : null}
      <Button label="Eşleşme durumunu yenile" icon="RefreshCw" onPress={() => void run(auth.refresh, 'Eşleşme durumu güncellendi.')} secondary disabled={busy || auth.loading} />

      <Modal transparent visible={confirmLeave} animationType="fade" onRequestClose={() => { if (!busy) setConfirmLeave(false); }}>
        <View style={styles.backdrop}><View style={styles.dialog}>
          <Icon name="Unlink" color={theme.danger} size={30} />
          <AppText style={styles.dialogTitle}>Eşleşmeniz sonlandırılsın mı?</AppText>
          <AppText style={styles.body}>İkinizin de bu ortak alana erişimi sona erer. Devam etmeden önce bu değişikliği partnerinle konuştuğundan emin ol.</AppText>
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
          <Button label="Eşleşmeyi sonlandır" color={theme.danger} loading={busy} onPress={() => void run(async () => { await auth.leaveCouple(); setConfirmLeave(false); }, 'Eşleşmeniz sonlandırıldı.')} />
          <Button label="Birlikte kalalım" onPress={() => setConfirmLeave(false)} secondary disabled={busy} />
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  body: { fontSize: 13, color: theme.muted, lineHeight: 23 },
  heading: { fontFamily: theme.bold, fontSize: 14, marginBottom: 5 },
  paired: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  pairedIcon: { width: 49, height: 49, backgroundColor: theme.brandLight, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  invitation: { padding: 20, backgroundColor: theme.brandLight, borderRadius: 20, gap: 12 },
  codeLabel: { fontSize: 9, letterSpacing: 1.4, color: theme.brand, fontFamily: theme.bold, textAlign: 'center' },
  code: { fontSize: 33, letterSpacing: 6, fontFamily: theme.extrabold, textAlign: 'center', color: theme.brandDark },
  expiry: { fontSize: 10, color: theme.brand, textAlign: 'center' },
  small: { fontSize: 11, color: theme.muted, lineHeight: 19 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 3 },
  line: { height: 1, backgroundColor: theme.border, flex: 1 },
  or: { fontSize: 10, color: theme.muted },
  error: { fontSize: 12, color: theme.danger, lineHeight: 20 },
  success: { fontSize: 12, color: theme.brand, lineHeight: 20 },
  backdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(23,36,59,0.4)', justifyContent: 'center', alignItems: 'center' },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 28, backgroundColor: theme.surface, padding: 26, gap: 18 },
  dialogTitle: { fontFamily: theme.bold, fontSize: 22, letterSpacing: -0.7 },
});

import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Button, Gradient, Icon, Screen } from '../src/components/ui';
import { categoryById } from '../src/constants/categories';
import { theme } from '../src/constants/theme';
import { useApp } from '../src/hooks/useApp';
import type { AppSettings, HomeCardId } from '../src/types';

const plants: { id: AppSettings['plant']; name: string; emoji: string; description: string }[] = [
  { id: 'heart', name: 'Kalp kalbe karşı', emoji: '🌿', description: 'Sevgiyle büyür' },
  { id: 'violet', name: 'Menekşe', emoji: '🌸', description: 'Yuvanıza renk katar' },
  { id: 'cactus', name: 'Kaktüs', emoji: '🌵', description: 'Biraz daha dayanıklı' },
];

export default function CustomizeScreen() {
  const { settings, ready, updateSettings } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function persist(patch: Partial<AppSettings>) {
    setBusy(true);
    setError('');
    try {
      await updateSettings(patch);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Değişiklik kaydedilemedi. Yeniden deneyebilirsin.');
    } finally {
      setBusy(false);
    }
  }

  function change(order: HomeCardId[], hidden = settings.hiddenCards) {
    return persist({ homeOrder: order, hiddenCards: hidden });
  }

  function move(index: number, direction: -1 | 1) {
    const order = [...settings.homeOrder];
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    void change(order);
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={() => router.back()} style={styles.back}>
            <Icon name="ArrowLeft" size={23} color={theme.text} />
          </Pressable>
          <AppText style={styles.title}>Bugün’ü düzenle</AppText>
        </View>
        <AppText style={styles.description}>Kendi ritmini oluştur. Kartları oklarla taşı, görmek istediklerini açık bırak.</AppText>
        <View style={styles.tip}>
          <Icon name="Palette" color={theme.brand} size={20} />
          <AppText style={styles.tipText}>Bu seçimler yalnızca ana ekranının görünümünü değiştirir.</AppText>
        </View>
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <View style={styles.plantSection}>
          <View style={styles.plantHeading}><Icon name="Sprout" size={21} color={theme.brand} /><AppText style={styles.plantTitle}>Yuvanızın bitkisi</AppText></View>
          <AppText style={styles.plantDescription}>Ana ekrandaki rafın küçük sakinini seç. Ortak alanda yaptığınız seçim iki telefonda da görünür.</AppText>
          <View style={styles.plants}>
            {plants.map(plant => {
              const selected = settings.plant === plant.id;
              return <Pressable key={plant.id}
                accessibilityRole="radio"
                accessibilityLabel={plant.name}
                accessibilityState={{ checked: selected, disabled: busy || !ready }}
                aria-checked={selected}
                disabled={busy || !ready}
                onPress={() => { if (!selected) void persist({ plant: plant.id, plantStartedAt: null, wateredAt: null }); }}
                style={({ pressed }) => [styles.plantOption, selected && styles.plantSelected, (busy || !ready) && styles.disabled, pressed && { opacity: 0.75 }]}>
                <AppText style={styles.plantEmoji}>{plant.emoji}</AppText>
                <AppText style={styles.plantName}>{plant.name}</AppText>
                <AppText style={styles.plantHint}>{plant.description}</AppText>
                <View style={[styles.plantCheck, selected && styles.plantCheckSelected]}>{selected ? <Icon name="Check" size={12} color={theme.white} /> : null}</View>
              </Pressable>;
            })}
          </View>
        </View>
        <View style={styles.rows}>
          {settings.homeOrder.map((id, index) => {
            const category = id === 'upcoming'
              ? { name: 'Yaklaşanlar', icon: 'CalendarClock', colors: ['#414A56', '#586370'] as const, ink: '#FFFFFF' }
              : categoryById[id];
            if (!category) return null;
            const visible = !settings.hiddenCards.includes(id);
            return (
              <View key={id} style={[styles.row, !visible && styles.rowHidden]}>
                <Gradient colors={category.colors} style={styles.categoryIcon}>
                  <Icon name={category.icon} size={21} color={category.ink} />
                </Gradient>
                <View style={styles.rowLabel}>
                  <AppText style={styles.name}>{category.name}</AppText>
                  <AppText style={styles.meta}>{visible ? 'Ana ekranda görünür' : 'Ana ekranda gizli'}</AppText>
                </View>
                <View style={styles.moveButtons}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${category.name} kartını yukarı taşı`} disabled={busy || index === 0} onPress={() => move(index, -1)} style={[styles.arrow, (busy || index === 0) && styles.disabled]}>
                    <Icon name="ArrowUp" size={17} color={theme.brand} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${category.name} kartını aşağı taşı`} disabled={busy || index === settings.homeOrder.length - 1} onPress={() => move(index, 1)} style={[styles.arrow, (busy || index === settings.homeOrder.length - 1) && styles.disabled]}>
                    <Icon name="ArrowDown" size={17} color={theme.brand} />
                  </Pressable>
                </View>
                <Switch
                  accessibilityLabel={`${category.name} kartını göster`}
                  value={visible}
                  disabled={busy}
                  onValueChange={value => void change(settings.homeOrder, value ? settings.hiddenCards.filter(card => card !== id) : [...settings.hiddenCards, id])}
                  trackColor={{ false: '#CCD5D9', true: theme.brand }}
                  thumbColor={theme.white}
                  ios_backgroundColor="#CCD5D9"
                />
              </View>
            );
          })}
        </View>
        <AppText style={styles.footnote}>Değişiklikler otomatik kaydedilir. Gizlediğin kategorilere Kategoriler ekranından her zaman ulaşabilirsin.</AppText>
        <Button label="Bugün’e dön" onPress={() => router.replace('/(tabs)')} icon="Check" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 48, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  title: { fontFamily: theme.extrabold, fontSize: 26, flex: 1, letterSpacing: -1 },
  description: { fontSize: 14, color: theme.muted, lineHeight: 23 },
  tip: { flexDirection: 'row', gap: 12, backgroundColor: theme.brandLight, padding: 16, borderRadius: 18, alignItems: 'center' },
  tipText: { color: theme.brandDark, fontSize: 12, lineHeight: 20, flex: 1 },
  error: { fontSize: 13, color: theme.danger, lineHeight: 21 },
  plantSection: { borderRadius: 22, padding: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, gap: 12 },
  plantHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  plantTitle: { fontFamily: theme.bold, fontSize: 16, letterSpacing: -0.3 },
  plantDescription: { fontSize: 11, color: theme.muted, lineHeight: 19 },
  plants: { flexDirection: 'row', gap: 8 },
  plantOption: { flex: 1, alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, paddingHorizontal: 5, gap: 7 },
  plantSelected: { borderColor: theme.brand, backgroundColor: theme.brandLight },
  plantEmoji: { fontSize: 30 },
  plantName: { fontFamily: theme.bold, fontSize: 11, lineHeight: 17, textAlign: 'center', minHeight: 34 },
  plantHint: { fontSize: 9, color: theme.muted, lineHeight: 14, textAlign: 'center', minHeight: 28 },
  plantCheck: { height: 19, width: 19, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  plantCheckSelected: { backgroundColor: theme.brand, borderColor: theme.brand },
  rows: { borderRadius: 22, overflow: 'hidden', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  row: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 17, alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowHidden: { backgroundColor: '#EBEFF2' },
  categoryIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, minWidth: 0 },
  name: { fontFamily: theme.bold, fontSize: 13 },
  meta: { fontSize: 10, marginTop: 4, color: theme.muted },
  moveButtons: { flexDirection: 'row', gap: 3 },
  arrow: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: theme.brandLight },
  disabled: { opacity: 0.3 },
  footnote: { fontSize: 12, lineHeight: 20, color: theme.muted },
});

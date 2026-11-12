import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { AppText, Button, Field, Icon } from './ui';
import { moods, type Category } from '../constants/categories';
import { theme } from '../constants/theme';
import { useApp } from '../hooks/useApp';
import type { ListItem, RecordInput, SharedRecord } from '../types';
import { localDay } from '../utils/date';
import { requireSupabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

export const createLabels: Record<string, string> = {
  calendar: 'Etkinlik ekle', 'special-days': 'Özel gün ekle', lists: 'Liste oluştur', notebook: 'Not ekle',
  documents: 'Bağlantı ekle', tasks: 'Görev ekle', 'partner-note': 'Not bırak', song: 'Şarkı ekle',
  gifts: 'Hediye fikri ekle', info: 'Bilgi ekle', places: 'Yer ekle', mood: 'Ruh hâlini paylaş', letters: 'Mektup gönder', gallery: 'Fotoğraf ekle',
};

interface Props { category: Category; record?: SharedRecord; visible: boolean; onClose: () => void; initialDate?: string }

function dateValue(value: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function timeValue(value: string) {
  const parsed = /^(\d{2}):(\d{2})$/.exec(value);
  const result = new Date();
  if (parsed) { result.setHours(Number(parsed[1]), Number(parsed[2]), 0, 0); }
  return result;
}

function DateField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') { setOpen(false); return; }
    if (selected) onChange(`${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`);
    if (Platform.OS !== 'ios') setOpen(false);
  };
  if (Platform.OS === 'web') return <Field label={label} value={value} onChangeText={onChange} placeholder="2026-11-10" autoCapitalize="none" maxLength={10} />;
  return <View style={{ flex: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.pickerField}><View style={{ flex: 1 }}><AppText style={styles.fieldLabel}>{label}</AppText><AppText style={styles.pickerValue}>{value || 'Tarih seç'}</AppText></View><Icon name="CalendarDays" size={20} color={theme.muted} /></Pressable>{open && <DateTimePicker value={dateValue(value)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleChange} />}</View>;
}

function TimeField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') { setOpen(false); return; }
    if (selected) onChange(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`);
    if (Platform.OS !== 'ios') setOpen(false);
  };
  if (Platform.OS === 'web') return <Field label={label} value={value} onChangeText={onChange} placeholder="Tüm gün" maxLength={5} />;
  return <View style={{ width: 116 }}><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.pickerField}><View style={{ flex: 1 }}><AppText style={styles.fieldLabel}>{label}</AppText><AppText style={styles.pickerValue}>{value || 'Tüm gün'}</AppText></View><Icon name="Clock3" size={19} color={theme.muted} /></Pressable>{open && <DateTimePicker value={timeValue(value)} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleChange} />}</View>;
}

export function RecordEditor(props: Props) {
  return props.visible ? <RecordEditorForm {...props} /> : null;
}

function RecordEditorForm({ category, record, visible, onClose, initialDate }: Props) {
  const { addRecord, updateRecord, mode } = useApp();
  const auth = useAuth();
  const [title, setTitle] = useState(record?.title ?? '');
  const [body, setBody] = useState(record?.body ?? '');
  const [date, setDate] = useState(record?.date ?? initialDate ?? localDay());
  const [time, setTime] = useState(record?.time ?? '');
  const [location, setLocation] = useState(record?.location ?? '');
  const [url, setUrl] = useState(record?.url ?? '');
  const [galleryUri, setGalleryUri] = useState(record?.url ?? '');
  const [price, setPrice] = useState(record?.price ?? '');
  const [mood, setMood] = useState(record?.mood ?? '');
  const [specialDayType, setSpecialDayType] = useState<'birthday' | 'anniversary' | 'other'>(record?.specialDayType ?? 'other');
  const [items, setItems] = useState<ListItem[]>(record?.items?.map(item => ({ ...item })) ?? []);
  const [itemText, setItemText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [letterEstimate, setLetterEstimate] = useState('Konuma göre hesaplanıyor…');
  const id = category.id;

  useEffect(() => {
    if (id !== 'letters') return;
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted' || !auth.pairing.coupleId) return;
        const own = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { data } = await requireSupabase().from('location_shares').select('latitude,longitude').eq('couple_id', auth.pairing.coupleId).neq('user_id', auth.session?.user.id ?? '').maybeSingle();
        if (!data || cancelled) return;
        const lat = (own.coords.latitude - Number(data.latitude)) * Math.PI / 180;
        const lon = (own.coords.longitude - Number(data.longitude)) * Math.PI / 180;
        const a = Math.sin(lat / 2) ** 2 + Math.cos(own.coords.latitude * Math.PI / 180) * Math.cos(Number(data.latitude) * Math.PI / 180) * Math.sin(lon / 2) ** 2;
        const minutes = Math.max(1, Math.ceil((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 60 * 60));
        if (!cancelled) setLetterEstimate(minutes < 60 ? `Yaklaşık ${minutes} dakika` : `Yaklaşık ${Math.floor(minutes / 60)} saat${minutes % 60 ? ` ${minutes % 60} dakika` : ''}`);
      } catch { /* gönderim yine de devam eder */ }
    })();
    return () => { cancelled = true; };
  }, [auth.pairing.coupleId, auth.session?.user.id, id]);


  const addItem = () => {
    if (!itemText.trim()) return;
    setItems(current => [...current, { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: itemText.trim(), done: false }]);
    setItemText('');
  };

  const save = async () => {
    setError('');
    let finalTitle = title.trim();
    if (id === 'partner-note') finalTitle = 'Sana bir not';
    if (id === 'letters') finalTitle = 'Güvercinli mektup';
    if (id === 'mood') finalTitle = moods.find(value => value.emoji === mood)?.label ?? '';
    if (!finalTitle) { setError(id === 'mood' ? 'Nasıl hissettiğini seç.' : 'Bir başlık yaz.'); return; }
    if (id === 'gallery' && !galleryUri) { setError('Önce bir fotoğraf seç.'); return; }
    if (['partner-note', 'letters'].includes(id) && !body.trim()) { setError('Göndermek istediğin notu yaz.'); return; }
    if (id === 'info' && !body.trim()) { setError('Bu bilgi için bir değer yaz.'); return; }
    const dated = ['calendar', 'special-days', 'places', 'mood', 'song', 'gallery'].includes(id);
    if (dated) {
      const parsed = new Date(`${date}T12:00:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || localDay(parsed) !== date) { setError('Geçerli bir tarih yaz: YYYY-AA-GG.'); return; }
    }
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { setError('Saati SS:DD biçiminde yaz, örneğin 19:30.'); return; }
    if (id !== 'gallery' && (url.trim() || id === 'documents')) {
      try { const parsed = new URL(url.trim()); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
      catch { setError('http:// veya https:// ile başlayan geçerli bir bağlantı yaz.'); return; }
    }
    if (body.length > (id === 'partner-note' ? 140 : id === 'mood' ? 280 : 10000)) { setError('Not, izin verilen karakter sınırını aşıyor.'); return; }
    const input: RecordInput = { category: id, title: finalTitle, body: body.trim() };
    if (id === 'letters') {
      let distanceKm = 0;
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status === 'granted' && auth.pairing.coupleId) {
          const own = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { data } = await requireSupabase().from('location_shares').select('latitude,longitude').eq('couple_id', auth.pairing.coupleId).neq('user_id', auth.session?.user.id ?? '').maybeSingle();
          if (data) {
            const lat = (own.coords.latitude - Number(data.latitude)) * Math.PI / 180;
            const lon = (own.coords.longitude - Number(data.longitude)) * Math.PI / 180;
            const a = Math.sin(lat / 2) ** 2 + Math.cos(own.coords.latitude * Math.PI / 180) * Math.cos(Number(data.latitude) * Math.PI / 180) * Math.sin(lon / 2) ** 2;
            distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          }
        }
      } catch { /* konum paylaşımı kapalıysa mektup hemen ulaşır */ }
      const flightMinutes = Math.max(1, Math.ceil(distanceKm / 60 * 60));
      input.distanceKm = Math.round(distanceKm * 10) / 10;
      input.deliveryAt = new Date(Date.now() + flightMinutes * 60_000).toISOString();
    }
    if (dated) input.date = date;
    if (id === 'calendar') { input.time = time; input.location = location.trim(); }
    if (id === 'special-days') input.specialDayType = specialDayType;
    if (id === 'lists') input.items = itemText.trim() ? [...items, { id: `item-${Date.now()}`, text: itemText.trim(), done: false }] : items;
    if (id === 'tasks') input.done = record?.done ?? false;
    if (['documents', 'song', 'gifts'].includes(id)) input.url = url.trim();
    if (id === 'gallery') input.url = galleryUri;
    if (id === 'gifts') input.price = price.trim();
    if (id === 'places') input.location = location.trim();
    if (id === 'mood') input.mood = mood;
    setBusy(true);
    try {
      if (record) await updateRecord(record.id, input, record.version); else await addRecord(input);
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kaydedilemedi. Tekrar deneyebilirsin.'); }
    finally { setBusy(false); }
  };

  const hasTitle = id !== 'mood' && id !== 'partner-note';
  const bodyLabel = id === 'song' ? 'Sanatçı' : id === 'info' ? 'Değer' : id === 'partner-note' ? 'Notun' : id === 'mood' ? 'Kısa bir not (isteğe bağlı)' : id === 'notebook' ? 'Notun' : 'Açıklama (isteğe bağlı)';
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} accessibilityLabel="Formu kapat" onPress={() => !busy && onClose()} />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}><AppText style={styles.eyebrow}>{category.name}</AppText><AppText style={styles.title}>{record ? 'Kaydı düzenle' : createLabels[id]}</AppText></View>
          <Pressable accessibilityRole="button" onPress={() => !busy && onClose()} accessibilityLabel="Kapat" style={styles.close}><Icon name="X" size={21} color={theme.text} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          {hasTitle && id !== 'letters' && <Field label={id === 'song' ? 'Şarkı adı' : id === 'lists' ? 'Liste adı' : id === 'places' ? 'Şehir / ülke' : id === 'documents' ? 'Görünen ad' : 'Başlık'} value={title} onChangeText={setTitle} placeholder={id === 'calendar' ? 'Birlikte ne yapıyoruz?' : id === 'lists' ? 'Örn. Haftalık alışveriş' : 'Buraya yaz…'} maxLength={200} autoFocus={Platform.OS === 'web'} />}
          {id === 'gallery' && <Button label={galleryUri ? 'Fotoğrafı değiştir' : 'Fotoğraf seç'} icon="Images" onPress={()=>{void (async()=>{const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){setError('Galeri izni gerekli.');return;}const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.85,exif:true});if(!result.canceled){setGalleryUri(result.assets[0].uri);const raw=(result.assets[0].exif as Record<string,unknown>|undefined)?.DateTimeOriginal;const match=typeof raw==='string'?raw.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})/):null;if(match)setDate(`${match[1]}-${match[2]}-${match[3]}`);}})();}}/>}
          {id === 'mood' && <View style={styles.moodGrid}>{moods.map(value => <Pressable key={value.label} onPress={() => setMood(value.emoji)} accessibilityRole="button" accessibilityLabel={value.label} aria-selected={mood === value.emoji} aria-pressed={mood === value.emoji} accessibilityState={{ selected: mood === value.emoji }} style={[styles.moodChoice, mood === value.emoji && { borderColor: category.colors[0], backgroundColor: '#E8E6F2' }]}><AppText style={{ fontSize: 29 }}>{value.emoji}</AppText><AppText style={styles.moodLabel}>{value.label}</AppText></Pressable>)}</View>}
          {id === 'special-days' && <View><AppText style={styles.fieldLabel}>Özel gün türü</AppText><View style={styles.chips}>{([{ id: 'birthday', name: 'Doğum günü' }, { id: 'anniversary', name: 'Yıl dönümü' }, { id: 'other', name: 'Diğer' }] as const).map(item => <Pressable key={item.id} onPress={() => setSpecialDayType(item.id)} accessibilityRole="button" aria-selected={specialDayType === item.id} aria-pressed={specialDayType === item.id} accessibilityState={{ selected: specialDayType === item.id }} style={[styles.chip, specialDayType === item.id && { backgroundColor: category.colors[0], borderColor: category.colors[0] }]}><AppText style={{ fontSize: 12, fontFamily: theme.semibold, color: specialDayType === item.id ? '#FFF' : theme.text }}>{item.name}</AppText></Pressable>)}</View>{specialDayType !== 'other' && <AppText style={styles.hint}>Her yıl aynı gün hatırlanır.</AppText>}</View>}
          {['calendar', 'special-days', 'places', 'gallery'].includes(id) && <View style={styles.row}><DateField label={id === 'gallery' ? 'Fotoğraf tarihi' : 'Tarih'} value={date} onChange={setDate} />{id === 'calendar' && <TimeField label="Saat (isteğe bağlı)" value={time} onChange={setTime} />}</View>}
          {['calendar', 'places'].includes(id) && <Field label={id === 'places' ? 'Konum / semt (isteğe bağlı)' : 'Konum (isteğe bağlı)'} value={location} onChangeText={setLocation} placeholder="Örn. Evde" maxLength={200} />}
          {id === 'lists' ? <View style={{ gap: 10 }}><AppText style={styles.fieldLabel}>Liste maddeleri</AppText>{items.map((item, index) => <View key={item.id} style={styles.itemRow}><Icon name={item.done ? 'CircleCheck' : 'Circle'} size={18} color={category.colors[0]} /><TextInput accessibilityLabel={`${index + 1}. madde`} value={item.text} onChangeText={text => setItems(current => current.map((value, i) => i === index ? { ...value, text } : value))} style={styles.itemInput} /><Pressable accessibilityRole="button" onPress={() => setItems(current => current.filter((_, i) => i !== index))} accessibilityLabel={`${item.text} maddesini kaldır`} style={styles.smallControl}><Icon name="X" size={17} color={theme.muted} /></Pressable></View>)}<View style={styles.itemRow}><TextInput accessibilityLabel="Yeni liste maddesi" value={itemText} onChangeText={setItemText} onSubmitEditing={addItem} placeholder="Bir madde ekle…" placeholderTextColor={theme.muted} style={styles.itemInput} returnKeyType="done" /><Pressable accessibilityRole="button" onPress={addItem} accessibilityLabel="Madde ekle" style={styles.smallControl}><Icon name="Plus" size={21} color={category.colors[0]} /></Pressable></View></View> : <View><Field label={id === 'letters' ? 'Mektubun' : bodyLabel} value={body} onChangeText={setBody} placeholder={id === 'letters' ? 'Uzaklara birkaç güzel kelime…' : id === 'partner-note' ? 'Aklımdan geçtin…' : id === 'song' ? 'Örn. Sezen Aksu' : 'Buraya yaz…'} multiline={id !== 'song'} numberOfLines={id === 'song' ? 1 : 4} maxLength={id === 'partner-note' ? 140 : id === 'mood' ? 280 : 10000} style={id !== 'song' ? { minHeight: 104, textAlignVertical: 'top' } : undefined} />{id === 'letters' && <AppText style={styles.hint}>Ulaştığında açılacak · {letterEstimate}</AppText>}{['partner-note', 'mood'].includes(id) && <AppText style={styles.counter}>{body.length} / {id === 'partner-note' ? '140' : '280'}</AppText>}</View>}
          {['documents', 'song', 'gifts'].includes(id) && <Field label={id === 'documents' ? 'Bağlantı adresi' : 'Bağlantı (isteğe bağlı)'} value={url} onChangeText={setUrl} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />}
          {id === 'gifts' && <Field label="Fiyat (isteğe bağlı)" value={price} onChangeText={setPrice} placeholder="Örn. 750 TL" maxLength={50} />}
          {id === 'documents' && <AppText style={styles.hint}>Bağlantıları saklayabilirsin. Dosya yükleme bu sürümde henüz kullanıma açık değil.</AppText>}
          {!!error && <View style={styles.error}><Icon name="CircleAlert" size={17} color={theme.danger} /><AppText style={{ flex: 1, color: theme.danger, fontSize: 13 }}>{error}</AppText></View>}
          <Button label={busy ? 'Gönderiliyor…' : record ? 'Değişiklikleri kaydet' : id === 'letters' ? 'Gönder' : id === 'partner-note' ? 'Notu bırak' : 'Kaydet'} onPress={save} icon="Check" color={category.colors[0]} loading={busy} disabled={busy} />
          <AppText style={styles.footerNote}>{mode === 'local' ? 'Bu cihazdaki deneme alanına kaydedilir.' : 'İkinizin ortak alanına kaydedilir.'}</AppText>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(23,36,59,0.36)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '92%', backgroundColor: theme.surface, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF' },
  sheetHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 24, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: theme.border },
  eyebrow: { fontSize: 11, fontFamily: theme.bold, color: theme.muted, marginBottom: 5, letterSpacing: 0.6 }, title: { fontSize: 23, fontFamily: theme.extrabold },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E9EDF0', alignItems: 'center', justifyContent: 'center' },
  form: { padding: 24, gap: 19 }, row: { flexDirection: 'row', gap: 12 },
  pickerField: { minHeight: 62, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerValue: { fontSize: 14, color: theme.text, fontFamily: theme.semibold },
  fieldLabel: { fontSize: 12, fontFamily: theme.bold, marginBottom: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  hint: { fontSize: 11, color: theme.muted, lineHeight: 18, marginTop: 7 },
  counter: { fontSize: 10, color: theme.muted, textAlign: 'right', marginTop: 5 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, moodChoice: { width: '31%', minHeight: 86, borderRadius: 17, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', gap: 4 }, moodLabel: { fontSize: 11, fontFamily: theme.semibold },
  itemRow: { flexDirection: 'row', gap: 9, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingLeft: 12, paddingRight: 4, minHeight: 46, backgroundColor: '#FFFFFF' },
  itemInput: { flex: 1, color: theme.text, fontFamily: theme.font, fontSize: 13, paddingVertical: 12, minWidth: 0 }, smallControl: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  error: { padding: 12, borderRadius: 12, flexDirection: 'row', gap: 8, backgroundColor: '#F4E8EC' },
  footerNote: { textAlign: 'center', fontSize: 11, color: theme.muted },
});

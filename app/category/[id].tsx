import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, Button, Icon } from '../../src/components/ui';
import { RecordEditor, createLabels } from '../../src/components/RecordEditor';
import { categoryById, type Category } from '../../src/constants/categories';
import { theme } from '../../src/constants/theme';
import { useApp } from '../../src/hooks/useApp';
import type { CategoryId, SharedRecord } from '../../src/types';
import { localDay } from '../../src/utils/date';
const booksCover = require('../../assets/books.png');

const unsupported: Partial<Record<CategoryId, { title: string; body: string }>> = {
  voice: { title: 'Bazı anılar sesinizle güzel', body: 'Sesli anı kaydı bu sürümde henüz kullanıma açık değil.' },
  steps: { title: 'Her adımda biraz daha birlikte', body: 'Adım sayımı bu sürümde henüz kullanıma açık değil.' },
};
const emptyCopy: Partial<Record<CategoryId, { title: string; body: string }>> = {
  calendar: { title: 'Bugün için boş bir sayfa', body: 'Bir akşam yemeği, küçük bir yürüyüş… İlk ortak planınızı ekleyin.' },
  'special-days': { title: 'Güzel tarihleri birlikte hatırlayın', body: 'Doğum günlerini ve yıl dönümlerinizi ekleyin. Her yıl yeniden hatırlansın.' },
  lists: { title: 'Birlikte bir liste yapın', body: 'Alışveriş, filmler, kitaplar veya bir gün gideceğiniz yerler. İlk maddenizle başlayın.' },
  notebook: { title: 'Aklınızda kalmasın', body: 'Fikirlerinizi, planlarınızı ve hatırlamak istediklerinizi ortak not defterinize yazın.' },
  tasks: { title: 'Birlikte halledersiniz', body: 'Yapılacakları buraya bırakın. Tamamladıkça birer birer işaretleyin.' },
  'partner-note': { title: 'Küçücük bir not, kocaman bir gülümseme', body: 'Partnerine bir not bırak. Bugün ekranında karşısına çıksın.' },
  song: { title: 'Bugünün melodisi ne olsun?', body: 'İkiniz de her gün bir şarkı seçebilirsiniz. Bugüne bir melodi ekleyin.' },
  mood: { title: 'Bugün nasıl hissediyorsun?', body: 'Bir emojiyle anlat, istersen küçük bir not da ekle. Birbirinize iyi gelin.' },
  documents: { title: 'İhtiyacınız olduğunda burada', body: 'Sık kullandığınız bağlantıları bir arada saklayın. İkiniz de açabilir ve düzenleyebilirsiniz.' },
};

export default function CategoryScreen() {
  const params = useLocalSearchParams<{ id: string; create?: string }>();
  const { ready } = useApp();
  const category = categoryById[params.id as CategoryId];
  if (!ready) return <View style={styles.unknown}><ActivityIndicator color={theme.brand} /><AppText style={styles.emptyBody}>Kayıtlarınız hazırlanıyor…</AppText></View>;
  if (!category) return <UnknownCategory />;
  return <CategoryContent key={category.id} category={category} create={params.create === '1'} />;
}

function UnknownCategory() {
  const router = useRouter();
  return <View style={styles.unknown}><Icon name="Search" color={theme.muted} size={40} /><AppText style={styles.emptyTitle}>Bu alan bulunamadı</AppText><Button label="Kategorilere dön" onPress={() => router.replace('/(tabs)/categories')} /></View>;
}

function CategoryContent({ category, create }: { category: Category; create: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ready, records, userId, reload, mode, error: appError, deleteRecord } = useApp();
  const [editor, setEditor] = useState(create && !unsupported[category.id]);
  const [editing, setEditing] = useState<SharedRecord | undefined>(() => create && (category.id === 'mood' || category.id === 'song') ? records.find(record => record.category === category.id && record.date === localDay() && record.authorId === userId) : undefined);
  const [selectedDay, setSelectedDay] = useState(localDay());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SharedRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (create) router.setParams({ create: undefined });
  }, [create, router]);
  const id = category.id;
  const available = !unsupported[id];
  const allRecords = records.filter(record => record.category === id);
  const today = localDay();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 29);
  const visibleRecords = allRecords.filter(record => id === 'calendar' ? record.date === selectedDay : id === 'mood' ? (record.date ?? '') >= localDay(cutoff) : true).sort((a, b) => id === 'calendar' ? `${a.time ?? ''}${a.title}`.localeCompare(`${b.time ?? ''}${b.title}`, 'tr') : `${b.date ?? b.createdAt}`.localeCompare(`${a.date ?? a.createdAt}`));
  const moodGroups = id === 'mood' ? Array.from(new Set(visibleRecords.map(record => record.date ?? record.createdAt.slice(0, 10)))).map(date => ({ date, records: visibleRecords.filter(record => (record.date ?? record.createdAt.slice(0, 10)) === date) })) : [];

  const openCreate = () => {
    const daily = id === 'mood' || id === 'song' ? allRecords.find(record => record.authorId === userId && record.date === today) : undefined;
    setEditing(daily); setEditor(true);
  };

  const refresh = async () => { setRefreshing(true); setError(''); try { await reload(); } catch (reason) { setError(message(reason)); } finally { setRefreshing(false); } };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true); setError('');
    try { await deleteRecord(pendingDelete.id, pendingDelete.version); setPendingDelete(null); } catch (reason) { setError(message(reason)); setPendingDelete(null); } finally { setDeleting(false); }
  };
  const sectionTitle = id === 'calendar' ? formatDay(selectedDay) : id === 'mood' ? 'Son 30 gün' : id === 'partner-note' ? 'Birbirinize bıraktığınız notlar' : id === 'tasks' ? 'Yapılacaklar' : id === 'song' ? 'Birlikte dinledikleriniz' : mode === 'local' ? 'Kayıtlarınız' : 'Ortak alanınız';
  const empty = emptyCopy[id] ?? { title: 'İlk kaydınızı birlikte ekleyin', body: category.description };

  return <View style={styles.page}>
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 10, paddingHorizontal: width < 380 ? 16 : 20 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={category.colors[0]} />}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/categories')} style={styles.back}><Icon name="ArrowLeft" size={23} color={theme.text} /></Pressable>
          <AppText style={styles.topBarTitle}>{category.name}</AppText>
          {available && <Pressable accessibilityRole="button" accessibilityLabel={createLabels[id]} onPress={openCreate} style={[styles.addCircle, { backgroundColor: category.colors[0] }]}><Icon name="Plus" size={22} color={category.ink} /></Pressable>}
        </View>
        {id !== 'calendar' && <View style={styles.intro}><LinearGradient colors={category.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.categorySymbol}><Icon name={category.icon} size={30} color={category.ink} /></LinearGradient><View style={{ flex: 1 }}><AppText style={styles.description}>{category.description}</AppText><AppText style={styles.sharedLabel}>{!available ? 'Henüz kullanıma açık değil' : mode === 'local' ? 'Bu cihazdaki deneme alanı' : 'İkinizin ortak alanı'}</AppText></View>{allRecords.length > 0 && <View style={styles.count}><AppText style={{ fontFamily: theme.bold, color: category.colors[0], fontSize: 14 }}>{allRecords.length}</AppText></View>}</View>}
        {!!(error || appError) && <View style={styles.error}><Icon name="CircleAlert" size={18} color={theme.danger} /><AppText style={{ flex: 1, color: theme.danger, fontSize: 12 }}>{error || appError}</AppText><Pressable accessibilityRole="button" accessibilityLabel="Hatayı kapat" onPress={() => setError('')}><Icon name="X" size={17} color={theme.danger} /></Pressable></View>}
        {!ready ? <View style={styles.loading}><ActivityIndicator color={category.colors[0]} /><AppText style={styles.emptyBody}>Ortak alanınız hazırlanıyor…</AppText></View> : <>
          {id === 'calendar' && <Calendar month={month} selected={selectedDay} records={allRecords} category={category} onSelect={setSelectedDay} onMonth={setMonth} />}
          {available ? <>
            <View style={styles.sectionHeading}><AppText style={styles.sectionTitle}>{sectionTitle}</AppText>{id === 'tasks' && allRecords.length > 0 && <AppText style={styles.smallMuted}>{allRecords.filter(record => record.done).length}/{allRecords.length} tamamlandı</AppText>}</View>
            {visibleRecords.length === 0 ? <View style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: `${category.colors[0]}12` }]}><Icon name={category.icon} size={32} color={category.colors[0]} /></View><AppText style={styles.emptyTitle}>{empty.title}</AppText><AppText style={styles.emptyBody}>{empty.body}</AppText><Button label={createLabels[id]} onPress={openCreate} icon="Plus" color={category.colors[0]} style={{ alignSelf: 'center', marginTop: 4 }} /></View> : id === 'mood' ? <View style={{ gap: 14 }}>{moodGroups.map(group => <View key={group.date} style={styles.moodDayGroup}><AppText style={styles.moodDayTitle}>{formatDay(group.date)}</AppText><View style={styles.moodDayRows}>{group.records.map(record => <RecordCard key={record.id} record={record} category={category} onEdit={() => { setEditing(record); setEditor(true); }} onDelete={() => setPendingDelete(record)} onError={setError} />)}</View></View>)}</View> : <View style={id === 'gallery' ? styles.galleryGrid : { gap: 10 }}>{visibleRecords.map(record => <RecordCard key={record.id} record={record} category={category} onEdit={() => { setEditing(record); setEditor(true); }} onDelete={() => setPendingDelete(record)} onError={setError} />)}</View>}
            {visibleRecords.length > 0 && <Button label={createLabels[id]} onPress={openCreate} icon="Plus" color={category.colors[0]} style={{ marginTop: 14 }} />}
            {id === 'documents' && <View style={styles.infoBox}><Icon name="LockKeyhole" size={18} color={theme.muted} /><AppText style={styles.infoText}>Bağlantılarınızı burada saklayabilirsiniz. Dosya yükleme bu sürümde henüz kullanıma açık değil.</AppText></View>}
            {id === 'places' && <View style={styles.infoBox}><Icon name="Map" size={18} color={theme.muted} /><AppText style={styles.infoText}>Ziyaretleriniz liste olarak saklanıyor. Harita görünümü bu sürümde henüz kullanıma açık değil.</AppText></View>}
          </> : <View style={[styles.empty, { marginTop: 12, paddingVertical: 44 }]}><View style={[styles.emptyIcon, { backgroundColor: `${category.colors[0]}14` }]}><Icon name={category.icon} size={40} color={category.colors[0]} /></View><AppText style={styles.emptyTitle}>{unsupported[id]!.title}</AppText><AppText style={styles.emptyBody}>{unsupported[id]!.body}</AppText></View>}
        </>}
        <View style={styles.pageFooter}><Icon name="Heart" size={11} color={theme.muted} /><AppText style={styles.footerText}>Birlikte, sizin için.</AppText></View>
      </View>
    </ScrollView>
    {available && <RecordEditor category={category} visible={editor} record={editing} initialDate={id === 'calendar' ? selectedDay : undefined} onClose={() => { setEditor(false); setEditing(undefined); }} />}
    <Modal visible={!!pendingDelete} transparent animationType="fade" onRequestClose={() => { if (!deleting) setPendingDelete(null); }}><View style={styles.modalBackdrop}><View style={styles.confirm}><View style={styles.deleteIcon}><Icon name="Trash2" size={27} color={theme.danger} /></View><AppText style={styles.confirmTitle}>Bu kayıt silinsin mi?</AppText><AppText style={styles.confirmBody}>{mode === 'local' ? `“${pendingDelete?.title}” bu cihazdaki deneme alanından kaldırılacak.` : `“${pendingDelete?.title}” ortak alanınızdan kaldırılacak. İkiniz için de silinir.`}</AppText><Button label={deleting ? 'Siliniyor…' : 'Kaydı sil'} onPress={confirmDelete} color={theme.danger} loading={deleting} disabled={deleting} /><Button label="Vazgeç" onPress={() => setPendingDelete(null)} secondary disabled={deleting} /></View></View></Modal>
  </View>;
}

function Calendar({ month, selected, records, category, onSelect, onMonth }: { month: Date; selected: string; records: SharedRecord[]; category: Category; onSelect: (day: string) => void; onMonth: (month: Date) => void }) {
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const numberOfDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + numberOfDays) / 7) * 7 }, (_, i) => { const day = i - firstWeekday + 1; return day > 0 && day <= numberOfDays ? day : null; });
  const dateFor = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const move = (delta: number) => { const next = new Date(year, monthIndex + delta, 1); onMonth(next); onSelect(localDay(next)); };
  return <View style={styles.calendar}>
    <LinearGradient colors={category.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.monthBar}>
      <Pressable accessibilityRole="button" onPress={() => move(-1)} accessibilityLabel="Önceki ay" style={styles.monthArrow}><Icon name="ChevronLeft" color="#FFFFFF" size={24} /></Pressable>
      <AppText style={styles.monthTitle}>{month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</AppText>
      <Pressable accessibilityRole="button" onPress={() => move(1)} accessibilityLabel="Sonraki ay" style={styles.monthArrow}><Icon name="ChevronRight" color="#FFFFFF" size={24} /></Pressable>
    </LinearGradient>
    <View style={styles.weekdays}>{WEEKDAYS.map(day => <AppText key={day} style={styles.weekday}>{day}</AppText>)}</View>
    <View style={styles.days}>{cells.map((day, index) => { const date = day ? dateFor(day) : ''; const active = date === selected; const hasEvent = records.some(record => record.date === date); const today = date === localDay(); return <View key={index} style={styles.cell}>{day && <Pressable onPress={() => onSelect(date)} accessibilityRole="button" accessibilityLabel={`${day} ${month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}${hasEvent ? ', etkinlik var' : ''}`} aria-selected={active} accessibilityState={{ selected: active }} style={[styles.day, active && { backgroundColor: category.colors[0] }, today && !active && { borderWidth: 1, borderColor: category.colors[0] }]}><AppText style={[styles.dayNumber, { color: active ? '#FFFFFF' : theme.text }]}>{day}</AppText>{hasEvent && <View style={[styles.dot, { backgroundColor: active ? '#FFFFFF' : category.colors[0] }]} />}</Pressable>}</View>; })}</View>
    <Pressable onPress={() => { const now = new Date(); onMonth(new Date(now.getFullYear(), now.getMonth(), 1)); onSelect(localDay()); }} style={styles.todayButton} accessibilityRole="button"><AppText style={{ color: category.colors[0], fontFamily: theme.bold, fontSize: 11 }}>Bugüne dön</AppText></Pressable>
  </View>;
}

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function RecordCard({ record, category, onEdit, onDelete, onError }: { record: SharedRecord; category: Category; onEdit: () => void; onDelete: () => void; onError: (error: string) => void }) {
  const { updateRecord, userId, profile } = useApp();
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const flightMinutes = record.distanceKm === undefined ? 0 : Math.max(1, Math.ceil(record.distanceKm / 60 * 60));
  const flightLabel = flightMinutes < 60 ? `${flightMinutes} dakika` : `${Math.floor(flightMinutes / 60)} saat ${flightMinutes % 60 ? `${flightMinutes % 60} dakika` : ''}`.trim();
  const mutate = async (patch: Partial<SharedRecord>) => { if (busy) return; setBusy(true); try { await updateRecord(record.id, patch, record.version); } catch (error) { onError(message(error)); } finally { setBusy(false); } };
  const openLink = async () => { try { const parsed = new URL(record.url ?? ''); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Geçersiz bağlantı.'); await Linking.openURL(parsed.toString()); } catch (reason) { onError(message(reason)); } };
  const addItem = async () => { if (!newItem.trim() || busy) return; const text = newItem.trim(); setBusy(true); try { await updateRecord(record.id, { items: [...(record.items ?? []), { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, done: false }] }, record.version); setNewItem(''); } catch (error) { onError(message(error)); } finally { setBusy(false); } };
  const complete = record.items?.filter(item => item.done).length ?? 0;
  const author = record.authorId === userId ? profile.name || 'Sen' : profile.partnerName || 'Partnerin';
  const isPartnerNote = category.id === 'partner-note';
  const isNote = isPartnerNote || category.id === 'notebook';
  const collapsible = isNote || category.id === 'lists';
  if (category.id === 'gallery') return <GalleryCard record={record} onEdit={onEdit} onDelete={onDelete} />;
  return <View style={[styles.recordCard, isPartnerNote && { backgroundColor: '#EEE4EE', borderColor: '#DDCBDD' }]}>{category.id === 'books' && <Image source={booksCover} resizeMode="cover" style={styles.bookCover} />}
    <View style={styles.recordTop}>
      {category.id === 'tasks' ? <Pressable accessibilityRole="checkbox" aria-checked={!!record.done} accessibilityState={{ checked: !!record.done, disabled: busy }} accessibilityLabel={`${record.title} ${record.done ? 'tamamlanmadı' : 'tamamlandı'} olarak işaretle`} onPress={() => mutate({ done: !record.done })} disabled={busy} style={styles.taskCheck}><Icon name={record.done ? 'CircleCheck' : 'Circle'} size={27} color={category.colors[0]} /></Pressable> : category.id === 'mood' ? <AppText style={{ fontSize: 34, marginRight: 3 }}>{record.mood}</AppText> : category.id === 'calendar' ? <View style={[styles.eventSymbol, { backgroundColor: `${category.colors[0]}15` }]}><Icon name="CalendarDays" size={23} color={category.colors[0]} /></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={category.id === 'lists' ? `${record.title} listesini ${expanded ? 'kapat' : 'aç'}` : isNote ? `${record.title} notunu ${expanded ? 'kapat' : 'aç'}` : `${record.title}, düzenle`} accessibilityState={collapsible ? { expanded } : undefined} onPress={collapsible ? () => setExpanded(value => !value) : onEdit} style={{ flex: 1 }}>
        <View style={styles.recordHeading}><AppText style={[styles.recordTitle, { flex: 1 }, record.done && { textDecorationLine: 'line-through', color: theme.muted }]}>{category.id === 'calendar' ? record.time || 'Tüm gün' : record.title}</AppText>{collapsible && <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={18} color={theme.muted} />}</View>
        {category.id === 'calendar' && <AppText style={styles.eventTitle}>{record.title}</AppText>}{category.id === 'mood' && <AppText style={styles.smallMuted}>{author} · {record.date ? formatDay(record.date) : ''}</AppText>}{category.id === 'lists' && <AppText style={styles.smallMuted}>{expanded ? 'Listeyi kapat' : `${record.items?.length ?? 0} maddeyi göster`}</AppText>}{category.id === 'letters' && <AppText style={styles.smallMuted}>{record.deliveryAt && Date.parse(record.deliveryAt) > renderedAt ? `Güvercin uçuyor · yaklaşık ${flightLabel}` : 'Mektup ulaştı'}</AppText>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${record.title} kaydını düzenle`} onPress={onEdit} style={styles.cardControl}><Icon name="Pencil" size={16} color={theme.muted} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`${record.title} kaydını sil`} onPress={onDelete} style={styles.cardControl}><Icon name="Trash2" size={16} color={theme.muted} /></Pressable>
    </View>
    {!!record.body && (isNote ? expanded && <AppText style={[styles.recordBody, isPartnerNote && styles.noteBubble]}>{record.body}</AppText> : category.id === 'letters' && record.deliveryAt && Date.parse(record.deliveryAt) > renderedAt ? <AppText style={styles.recordBody}>Mektup yolda… Ulaştığında açılacak.</AppText> : <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityLabel={expanded ? 'Metni kısalt' : 'Metnin tamamını göster'}><AppText numberOfLines={expanded ? undefined : 5} style={styles.recordBody}>{record.body}</AppText>{record.body.length > 240 && <AppText style={[styles.smallMuted, { marginTop: 6 }]}>{expanded ? 'Daha az göster' : 'Devamını oku'}</AppText>}</Pressable>)}
    {category.id === 'lists' && expanded && <View style={styles.listContent}><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${record.items?.length ? (complete / record.items.length) * 100 : 0}%`, backgroundColor: category.colors[0] }]} /></View><AppText style={styles.smallMuted}>{complete} / {record.items?.length ?? 0} tamamlandı</AppText>{record.items?.map(item => <View key={item.id} style={styles.listItem}><Pressable onPress={() => mutate({ items: record.items?.map(value => value.id === item.id ? { ...value, done: !value.done } : value) })} disabled={busy} accessibilityRole="checkbox" aria-checked={item.done} accessibilityState={{ checked: item.done }} accessibilityLabel={item.text} style={styles.listCheck}><Icon name={item.done ? 'CircleCheck' : 'Circle'} size={21} color={item.done ? category.colors[0] : '#A6B3B8'} /><AppText style={[styles.listText, item.done && { textDecorationLine: 'line-through', color: theme.muted }]}>{item.text}</AppText></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`${item.text} maddesini sil`} disabled={busy} onPress={() => mutate({ items: record.items?.filter(value => value.id !== item.id) })} style={styles.cardControl}><Icon name="X" size={15} color={theme.muted} /></Pressable></View>)}<View style={styles.addItem}><TextInput accessibilityLabel={`${record.title} listesine madde ekle`} style={styles.addItemInput} value={newItem} onChangeText={setNewItem} placeholder="Yeni bir madde…" placeholderTextColor={theme.muted} onSubmitEditing={addItem} returnKeyType="done" editable={!busy} maxLength={200} /><Pressable accessibilityRole="button" accessibilityLabel="Maddeyi ekle" onPress={addItem} disabled={busy || !newItem.trim()} style={styles.cardControl}><Icon name="Plus" color={newItem.trim() ? category.colors[0] : theme.muted} size={21} /></Pressable></View></View>}
    {(!isNote || expanded) && <View style={styles.recordMeta}>
      {!!record.date && category.id !== 'mood' && category.id !== 'calendar' && <View style={styles.metaItem}><Icon name="CalendarDays" size={12} color={theme.muted} /><AppText style={styles.metaText}>{formatDay(record.date)}</AppText></View>}
      {!!record.location && <View style={styles.metaItem}><Icon name="MapPin" size={12} color={theme.muted} /><AppText style={styles.metaText}>{record.location}</AppText></View>}
      {!!record.specialDayType && <View style={[styles.repeatBadge, { backgroundColor: `${category.colors[0]}12` }]}><Icon name={record.specialDayType === 'other' ? 'CalendarDays' : 'Repeat2'} size={11} color={category.colors[0]} /><AppText style={{ color: category.colors[0], fontSize: 10, fontFamily: theme.semibold }}>{record.specialDayType === 'birthday' ? 'Doğum günü · Her yıl' : record.specialDayType === 'anniversary' ? 'Yıl dönümü · Her yıl' : 'Tek seferlik'}</AppText></View>}
      {!!record.price && <AppText style={{ fontSize: 13, fontFamily: theme.bold, color: category.colors[0] }}>{record.price}</AppText>}
    </View>}
    {!!record.url && (!isNote || expanded) && <Pressable accessibilityRole="link" onPress={openLink} style={[styles.linkButton, { backgroundColor: `${category.colors[0]}0C` }]}><Icon name={category.id === 'song' ? 'Play' : 'ExternalLink'} color={category.colors[0]} size={16} /><AppText style={{ color: category.colors[0], fontSize: 12, fontFamily: theme.bold, flex: 1 }} numberOfLines={1}>{category.id === 'song' ? 'Şarkıyı dinle' : category.id === 'gifts' ? 'Hediyeye göz at' : record.url.replace(/^https?:\/\//, '')}</AppText><Icon name="ArrowUpRight" size={14} color={category.colors[0]} /></Pressable>}
    {isPartnerNote && expanded && <AppText style={styles.noteTime}>{author} · {new Date(record.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · {new Date(record.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</AppText>}
    {busy && <ActivityIndicator color={category.colors[0]} size="small" style={{ marginTop: 8 }} />}<Modal visible={galleryOpen} transparent animationType="fade" onRequestClose={()=>setGalleryOpen(false)}><View style={styles.galleryBackdrop}><Pressable onPress={()=>setGalleryOpen(false)} style={styles.galleryClose}><Icon name="X" color="#FFF" size={22}/></Pressable><View style={styles.fullPolaroid}><Image source={{uri:record.url}} resizeMode="contain" style={styles.fullGalleryImage}/><AppText style={styles.fullPolaroidTitle}>{record.title}</AppText><Button label="Düzenle" secondary onPress={()=>{setGalleryOpen(false);onEdit();}} /><Button label="Fotoğrafı sil" color={theme.danger} onPress={()=>{setGalleryOpen(false);onDelete();}} /></View></View></Modal>
  </View>;
}

function GalleryCard({ record, onEdit, onDelete }: { record: SharedRecord; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return <><Pressable accessibilityRole="button" accessibilityLabel={`${record.title} fotoğrafını aç`} onPress={() => setOpen(true)} style={styles.galleryOnly}><View style={styles.polaroid}><Image source={{ uri: record.url }} resizeMode="cover" style={styles.galleryImage} /><AppText style={styles.polaroidTitle}>{record.title}</AppText>{record.date && <AppText style={styles.polaroidDate}>{formatDay(record.date)}</AppText>}</View></Pressable><Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.galleryBackdrop}><Pressable onPress={() => setOpen(false)} style={styles.galleryClose}><Icon name="X" color="#FFF" size={22} /></Pressable><View style={styles.fullPolaroid}><Image source={{ uri: record.url }} resizeMode="contain" style={styles.fullGalleryImage} /><AppText style={styles.fullPolaroidTitle}>{record.title}</AppText>{record.date && <AppText style={styles.polaroidDate}>{formatDay(record.date)}</AppText>}<Button label="Düzenle" secondary onPress={() => { setOpen(false); onEdit(); }} /><Button label="Fotoğrafı sil" color={theme.danger} onPress={() => { setOpen(false); onDelete(); }} /></View></View></Modal></>;
}

function formatDay(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }); }
function message(error: unknown) { return error instanceof Error ? error.message : 'İşlem tamamlanamadı. Tekrar deneyebilirsin.'; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background }, scroll: { paddingBottom: 30 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center' }, galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, galleryOnly: { width: '48%', alignItems: 'center' }, polaroidDate: { fontSize: 9, color: '#9A806E', textAlign: 'center', marginTop: 4 },
  polaroid: { width: 170, alignSelf: 'center', backgroundColor: '#FFFDF9', padding: 9, paddingBottom: 13, borderRadius: 3, shadowColor: '#17243B', shadowOpacity: .12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }, galleryImage: { width: 152, height: 152 }, polaroidTitle: { fontSize: 11, color: '#59453A', fontFamily: theme.semibold, textAlign: 'center', marginTop: 8 }, galleryBackdrop: { flex: 1, backgroundColor: 'rgba(15,20,30,.9)', alignItems: 'center', justifyContent: 'center', padding: 24 }, galleryClose: { position: 'absolute', top: 50, right: 22, zIndex: 2, padding: 10 }, fullPolaroid: { backgroundColor: '#FFFDF9', padding: 14, paddingBottom: 20, width: '92%', maxWidth: 520, transform: [{ rotate: '-1deg' }] }, fullGalleryImage: { width: '100%', aspectRatio: 1 }, fullPolaroidTitle: { fontSize: 16, color: '#59453A', fontFamily: theme.semibold, textAlign: 'center', marginTop: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }, back: { width: 34, height: 40, justifyContent: 'center' }, topBarTitle: { flex: 1, fontSize: 25, fontFamily: theme.extrabold, letterSpacing: -0.9 }, addCircle: { width: 41, height: 41, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 18 }, categorySymbol: { width: 58, height: 58, borderRadius: 21, justifyContent: 'center', alignItems: 'center' }, description: { fontSize: 14, lineHeight: 21, fontFamily: theme.semibold }, sharedLabel: { fontSize: 10, color: theme.muted, marginTop: 3 }, count: { minWidth: 30, padding: 7, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11, marginTop: 4 }, sectionTitle: { fontSize: 17, fontFamily: theme.extrabold, flex: 1, letterSpacing: -0.4 }, smallMuted: { fontSize: 10, color: theme.muted, lineHeight: 16 }, moodDayGroup: { gap: 7 }, moodDayTitle: { fontSize: 13, fontFamily: theme.bold, color: theme.muted, textTransform: 'capitalize' }, moodDayRows: { gap: 8 },
  empty: { alignItems: 'center', padding: 26, paddingVertical: 35, backgroundColor: '#FAFBFC', borderWidth: 1, borderColor: theme.border, borderRadius: 24, gap: 13 }, emptyIcon: { width: 80, height: 80, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, emptyTitle: { fontSize: 20, fontFamily: theme.bold, textAlign: 'center', lineHeight: 29, maxWidth: 350 }, emptyBody: { fontSize: 13, lineHeight: 22, color: theme.muted, textAlign: 'center', maxWidth: 390 },
  error: { flexDirection: 'row', gap: 9, padding: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#F2E7EB', marginBottom: 18 }, loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 16 },
  calendar: { marginBottom: 16 }, monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 6 }, monthArrow: { width: 38, height: 33, alignItems: 'center', justifyContent: 'center' }, monthTitle: { color: '#FFFFFF', fontFamily: theme.bold, fontSize: 18, textTransform: 'capitalize' },
  weekdays: { flexDirection: 'row', marginTop: 12, marginBottom: 4 }, weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, color: theme.muted, fontFamily: theme.semibold }, days: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' }, day: { width: 38, height: 38, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, dayNumber: { fontSize: 15, fontFamily: theme.bold }, dot: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 4 }, todayButton: { alignSelf: 'center', padding: 7, marginTop: 2 },
  recordCard: { backgroundColor: '#FAFBFC', borderRadius: 19, borderWidth: 1, borderColor: theme.border, padding: 16, overflow: 'hidden' }, recordTop: { flexDirection: 'row', alignItems: 'center', gap: 6 }, recordHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, recordTitle: { fontSize: 16, lineHeight: 23, fontFamily: theme.bold }, recordBody: { fontSize: 13, lineHeight: 21, color: '#576472', marginTop: 9 }, noteBubble: { alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: '#F7EAF4', borderRadius: 18, paddingHorizontal: 15, paddingVertical: 11, fontSize: 16, lineHeight: 25, color: '#47394D' }, cardControl: { width: 29, height: 31, alignItems: 'center', justifyContent: 'center' },
  eventSymbol: { width: 46, height: 51, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 6 }, eventTitle: { fontSize: 13, lineHeight: 21, marginTop: 2, color: '#506073' }, taskCheck: { paddingVertical: 5, paddingRight: 5 },
  recordMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }, metaItem: { flexDirection: 'row', gap: 4, alignItems: 'center', maxWidth: '100%' }, metaText: { fontSize: 10, color: theme.muted }, repeatBadge: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkButton: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderRadius: 12, marginTop: 10 }, noteTime: { fontSize: 10, color: '#807084', marginTop: 14 },
  listContent: { marginTop: 14, gap: 9 }, progressTrack: { height: 5, borderRadius: 4, backgroundColor: '#E1E8E3', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 4 }, listItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EAF0EB' }, listCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingVertical: 10 }, listText: { fontSize: 13, lineHeight: 21, flex: 1 }, addItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2F0', borderRadius: 12, paddingHorizontal: 12, marginTop: 5 }, addItemInput: { flex: 1, minWidth: 0, color: theme.text, fontFamily: theme.font, fontSize: 12, paddingVertical: 13 },
  infoBox: { flexDirection: 'row', gap: 9, padding: 14, borderRadius: 15, backgroundColor: '#E8EDF1', marginTop: 21, alignItems: 'flex-start' }, infoText: { flex: 1, color: theme.muted, fontSize: 11, lineHeight: 18 }, comingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, backgroundColor: theme.brandLight, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 }, comingLabel: { color: theme.brand, fontSize: 10, fontFamily: theme.semibold },
  pageFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 30 }, footerText: { fontSize: 9, color: theme.muted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(23,36,59,0.36)', alignItems: 'center', justifyContent: 'center', padding: 24 }, confirm: { width: '100%', maxWidth: 380, backgroundColor: theme.surface, borderRadius: 25, padding: 26, gap: 15 }, deleteIcon: { width: 58, height: 58, borderRadius: 22, backgroundColor: '#F1E3E8', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' }, confirmTitle: { fontSize: 21, fontFamily: theme.bold, textAlign: 'center' }, confirmBody: { fontSize: 13, lineHeight: 22, color: theme.muted, textAlign: 'center', marginBottom: 7 }, unknown: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 25, backgroundColor: theme.background },
  bookCover: { width: 72, height: 92, borderRadius: 10, marginBottom: 10 }, galleryRecord: { width: '48%', padding: 10 },
});

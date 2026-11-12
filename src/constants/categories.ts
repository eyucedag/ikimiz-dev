import type { CategoryId, HomeCardId } from '../types';
export interface Category { id: CategoryId; name: string; shortName: string; icon: string; colors: readonly [string, string]; ink: string; description: string }
export const categories: Category[] = [
  {id:'calendar',name:'Takvim',shortName:'Takvim',icon:'CalendarDays',colors:['#3D6796','#4F77A7'],ink:'#FFFFFF',description:'Birlikte planladığınız güzel günler.'},
  {id:'special-days',name:'Özel Günler',shortName:'Özel Günler',icon:'Heart',colors:['#93485F','#A66075'],ink:'#FFFFFF',description:'Hatırlamaya değer bütün tarihler.'},
  {id:'lists',name:'Listeler',shortName:'Listeler',icon:'ListChecks',colors:['#346C59','#4C806D'],ink:'#FFFFFF',description:'Küçük ihtiyaçlardan büyük hayallere.'},
  {id:'notebook',name:'Not Defteri',shortName:'Not Defteri',icon:'NotebookPen',colors:['#BCBA67','#CFCD82'],ink:'#17243B',description:'Aklınızda kalmasın, burada kalsın.'},
  {id:'documents',name:'Dokümanlar',shortName:'Dokümanlar',icon:'FileText',colors:['#66758C','#68768A'],ink:'#FFFFFF',description:'Ortak dosyalarınız ve bağlantılarınız.'},
  {id:'gallery',name:'Galeri',shortName:'Galeri',icon:'Images',colors:['#62458A','#785B9F'],ink:'#FFFFFF',description:'Birlikte biriktirdiğiniz kareler.'},
  {id:'voice',name:'Sesli Anılar',shortName:'Sesli Anılar',icon:'Mic',colors:['#9C6854','#956B59'],ink:'#FFFFFF',description:'Sesinizle sakladığınız küçük anılar.'},
  {id:'tasks',name:'Görevler',shortName:'Görevler',icon:'CircleCheck',colors:['#2C6E72','#3F7E82'],ink:'#FFFFFF',description:'Birlikte yapınca her şey daha kolay.'},
  {id:'partner-note',name:'Partnerinden Not',shortName:'Partner Notu',icon:'MessageSquareHeart',colors:['#B78DAE','#C9A1BF'],ink:'#17243B',description:'Gününe küçük bir güzellik bırak.'},
  {id:'letters',name:'Güvercinli Mektup',shortName:'Mektuplar',icon:'Send',colors:['#7D6658','#A18370'],ink:'#FFFFFF',description:'Mesafeyi aşan bir mektup gönder.'},
  {id:'song',name:'Günün Şarkısı',shortName:'Günün Şarkısı',icon:'Music2',colors:['#2C3A65','#424F7C'],ink:'#FFFFFF',description:'Bugünün bir de melodisi olsun.'},
  {id:'gifts',name:'Hediye Radarı',shortName:'Hediye Radarı',icon:'Gift',colors:['#68584D','#7D6B60'],ink:'#FFFFFF',description:'Birbirinize iyi gelecek fikirler.'},
  {id:'info',name:'Bilinmesi Gerekenler',shortName:'Bilgiler',icon:'Info',colors:['#706D69','#787470'],ink:'#FFFFFF',description:'Birbirinizle ilgili küçük, önemli detaylar.'},
  {id:'places',name:'Gezdiğimiz Yerler',shortName:'Gezdiğimiz Yerler',icon:'MapPin',colors:['#8BB8C9','#A0CDD9'],ink:'#17243B',description:'Haritada iz bırakan anılarınız.'},
  {id:'steps',name:'Birlikte Atılan Adımlar',shortName:'Birlikte Atılan Adımlar',icon:'Footprints',colors:['#80935B','#94A770'],ink:'#17243B',description:'Yan yana atılan her adım değerli.'},
  {id:'mood',name:'Ruh Halim',shortName:'Ruh Halim',icon:'Smile',colors:['#AEADD0','#C1BFDE'],ink:'#17243B',description:'Bugün nasıl hissediyorsun?'},
];
export const categoryById = Object.fromEntries(categories.map(c => [c.id,c])) as Record<CategoryId,Category>;
export const defaultHomeOrder: HomeCardId[] = ['upcoming','partner-note','mood','lists','song','special-days','notebook','documents','gallery','voice','gifts','info','places','steps','letters'];
export const moods = [{label:'Harika',emoji:'🤩'},{label:'İyi',emoji:'😊'},{label:'İdare eder',emoji:'😐'},{label:'Keyifsiz',emoji:'😔'},{label:'Zorlanıyorum',emoji:'😣'},{label:'Yorgunum',emoji:'😴'},{label:'Enerjik',emoji:'💪'},{label:'Kızgın',emoji:'😡'},{label:'Sıkılmış',emoji:'😒'}];

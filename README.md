# İkimiz

İki partnerin ortak yaşam alanı. Expo / React Native, TypeScript, Expo Router ve Supabase ile geliştiriliyor. Bu depo **ilk çalışan geliştirme sürümüdür**; ürün kapsamının tamamı henüz uygulanmadı.

Görünüm referansı **Ortak Yuva — serin alt tonlar**. Tam ürün anlatımı ve son renk kararları [docs/APP_REFERENCE.md](docs/APP_REFERENCE.md) dosyasında korunur. Referanstaki isim, tarih, sayaç ve etkinlikler başlangıç verisi olarak eklenmez. Kategori renklerinin aileleri ve açık/koyu ayrımı korunur; küçük yazılarda en az 4.5:1 kontrast için önerilen geçiş değerleri gerektiğinde hafifçe ayarlanmıştır.

## Çalıştırma

Node.js 22.13 veya üzeri kullanın. Bağımlılıklar Expo SDK 58'e göre hizalanmıştır.

```sh
npm ci
npm run web
```

Telefon için `npm start` ile Expo'yu başlatın; SDK 58 ile uyumlu Expo Go veya geliştirme derlemesini kullanın. `npm run android` / `npm run ios` yerel emülatör araçlarını gerektirir. Web, aynı React Native ekranlarının tarayıcı önizlemesidir.

İki fiziksel telefonda Expo Go için `npm run start:go` kullanın ve aynı QR kodunu iki cihazda açın. Aynı Wi‑Fi ağına bağlı yerel bir geliştirme bilgisayarında tünel yerine `npm run start:go:lan` daha hızlıdır. Supabase e-posta doğrulama ve parola kurtarma yönlendirmesinin o Expo Go oturumunun adresine eklenmesi gerekir; ayrıntılar [Supabase kurulumunda](supabase/README.md) yer alır.

Bu bulut çalışma alanında önizleme `http://localhost:8082` adresinde çalıştırıldı. Başka bir makinede yeniden başlattığınızda Expo'nun verdiği adresi kullanın.

Kalıcı `shared-preview` kanalı için [EAS Update yayın adımlarını](docs/SHARED_PREVIEW.md) izleyin. Proje kimliği ve `1.0.0` runtime yapılandırıldı; `npm run update:preview -- --message "İkimiz ortak önizleme"` iOS ve Android güncellemesini aynı kanala gönderir. Yayın için Expo API ve dosya yükleme hedeflerine ağ erişimi gerekir.

## Bu sürümde çalışanlar

- Beş sekmeli ana gezinme; kategori renkleri, kompakt gün/gece manzarası ve 15 kategoriye erişim.
- Kullanıcının isimleri ve ilişki başlangıcından hesaplanan canlı sayaç.
- Aylık takvim, gün seçimi, saatli/tüm gün etkinliği ve yedi günlük Yaklaşanlar.
- Yıllık doğum günü/yıl dönümü ve bir defalık özel günler.
- Listeler, madde ekleme/tamamlama/silme; ortak notlar ve görevler.
- Partner notu, dokuz ruh hâli, günlük kişi başı tek kayıt ve günlük şarkı.
- Hediye fikirleri, önemli bilgiler, ziyaret listesi ve güvenli HTTP(S) bağlantıları.
- Kayıt ekleme, düzenleme, silme onayı, hata durumları ve eski sürümü ezmeme kontrolü.
- Kategori bazında ana ekran gizleme/gösterme ve yukarı/aşağı sıralama.
- Yerel bitki seçimi/sulama ve açıkça etiketlenmiş öpücük önizlemesi.
- Yapılandırılmış Supabase ile e-posta/parola hesabı, doğrulama/kurtarma, davet oluşturma/kabul/ret/iptal, eşleşme, ortak kayıt senkronizasyonu ve öpücük bildirimleri.

## Yerel alan ve gerçek ortak alan

Ortam değişkenleri yoksa uygulama boş bir **bu cihazdaki deneme alanı** ile açılır. Kayıtlar AsyncStorage'da kalıcı saklanır; diğer cihazlara veya partnere gönderilmez. Yerel kayıtlar giriş yapıldığında kendiliğinden ortak hesaba aktarılmaz.

Gerçek paylaşım için [.env.example](.env.example) şablonunu yerel `.env` dosyasına kopyalayın, proje URL'si ve anon/publishable anahtarı ayarlayın, [Supabase kurulum sırasını](supabase/README.md) izleyin ve Expo'yu yeniden başlatın. Gizli sunucu anahtarları istemciye konmaz. Giriş yapılmış fakat eşleşmemiş hesap ortak kayıt oluşturamaz.

Her etkin partner ortak içeriği aynı yetkilerle görür, düzenler ve siler. `created_by` yalnızca kaynağı belirtir. Farklı çiftlerin verileri RLS ve özel Storage politikalarıyla ayrılır. Sürüm uyuşmazlığı sessizce eski veriyi yazmaz.

Bu çalışma sırasında canlı Supabase projesine bağlanılmadı ve canlı migration uygulanmadı. SQL, geçici PostgreSQL motorunda doğrulandı; gerçek iki cihaz Realtime/Auth/Storage HTTP kontrolleri kurulum sonrasında yapılmalıdır.

## Sıradaki kapsam

Galeri yükleme ve tam ekran görüntüleme; PDF/Word/görsel dosya yükleme/indirme ve dosya yaşam döngüsü; üç dakikalık ses kaydı; konum yön paylaşımı; adım sensörü; ziyaret haritası; ortak bitki sağlığı/senkronizasyonu; not görseli/emoji/okunma; sistem push bildirimleri; Google/Apple sağlayıcıları ve hesap silme. İlgili ekranlarda tamamlanmamış işlemler çalışır düğmeler gibi sunulmaz. Yerel bitki bakımı şu an sağlık simülasyonu içermez.

## Kontroller

```sh
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:ui
npm run export
```

`test:ui`, Playwright Chromium ile gerçek kayıt akışlarını ve telefon/tablet genişliklerini kontrol eder. Sistemde `/usr/bin/chromium` varsa onu kullanır; başka kurulumda `npx playwright install chromium` veya `CHROMIUM_PATH` kullanın. Testler yerel deneme alanında ve ayrı tarayıcı bağlamlarında çalışır; canlı veriye dokunmaz.

`test:db`, PGlite içinde asıl SQL migration'ını çalıştırarak eşit partner yetkilerini, çift izolasyonunu, davetleri, Storage politikalarını ve sürüm kontrollerini sınar. Native sensör/izin davranışları, mağaza derlemesi ve gerçek hizmet bağlantıları için cihaz testleri gerekir.

## Kaynak yapısı

`app/` ekran ve rotalar, `src/components/` ortak arayüz, `src/hooks/` kimlik ve veri durumu, `src/services/` yerel/Supabase işlemleri, `src/constants/` tema/kategoriler, `src/utils/` yerel tarih hesabı, `supabase/` şema ve testler, `e2e/` tarayıcı akışları.

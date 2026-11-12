# İkimiz Supabase temeli

Bu klasör ilk kurulumun veritabanı şemasını, çift üyeliğini, davet işlemlerini, ortak kayıtların yetkilerini ve özel dosya alanını içerir. Expo uygulamasını çalıştırmak canlı veritabanında SQL çalıştırmaz.

## Kurulum sırası

1. Ayrı bir geliştirme Supabase projesi oluşturun. E-posta/parola sağlayıcısını, e-posta doğrulamasını ve parola kurtarma yönlendirme adreslerini projenin Auth ayarlarında yapılandırın.
2. Yeni veritabanında yalnızca `migrations/202611100001_initial.sql` dosyasını bir kez çalıştırın. Dosya tek transaction içerir. Sonraki migration'lar tarih sırasıyla uygulanır.
3. Projenin URL'sini ve **anon/public** anahtarını uygulama kökündeki `.env.example` örneğine göre yerel `.env` dosyasına ekleyin. Uygulama istemcisine `service_role` anahtarı verilmez.
4. Expo sürecini yeniden başlatın. İki ayrı hesapla kayıt, e-posta doğrulama, giriş, altı karakterli davet ve eşleşme akışlarını deneyin.

Auth yönlendirme izin listesi kullanılan çalıştırma biçimiyle eşleşmelidir: native derlemede `ikimiz://auth`, Expo Go'da o oturumun `exp://.../--/auth` adresi, web'de uygulamanın gerçek origin'i altındaki `/auth` adresi. Parola yenileme aynı yola `recovery=1` sorgusunu ekler. Expo Go tünel adresi oturumlar arasında değişebilir; geliştirme sırasında o oturumun tam `/--/auth` adresini Supabase **Authentication → URL Configuration → Redirect URLs** listesine ekleyin. İsterseniz aynı değeri `.env` içinde `EXPO_PUBLIC_AUTH_REDIRECT_URL` olarak sabitleyin. Üretimde geniş bir genel joker yerine kendi uygulama adreslerinizi kullanın.

### Expo Go ile iki telefon

1. Her iki telefona da güncel Expo Go'yu kurun. Uygulama Expo SDK 58 kullanır.
2. Proje kökünde `npm run start:go` çalıştırın. Terminaldeki aynı QR kodunu iPhone kamera uygulamasıyla ve Android Expo Go içindeki QR tarayıcıyla açın.
3. Terminalde görünen `exp://...` adresinin sonuna `/--/auth` ekleyip Supabase Redirect URLs listesine yazın. Örnek: `exp://abc-8081.exp.direct/--/auth`.
4. Expo sürecini `.env` değişikliğinden sonra yeniden başlatın. İki telefonda iki farklı e-posta hesabı oluşturun; birinci telefonda davet kodu üretin, ikinci telefonda kodu kabul edin.

Tünel çalışmıyorsa ve bilgisayar ile iki telefon aynı Wi‑Fi ağındaysa `npm run start:go:lan` kullanabilirsiniz. LAN adresi farklı bir ağdaki telefondan açılmaz. Expo Go yönlendirme adresleri yalnız geliştirme içindir; mağaza/dev build aşamasında kararlı `ikimiz://auth` şemasına geçilir.

`schema.sql`, ilk migration'ın birebir okunabilir kopyasıdır. Migration'dan sonra ayrıca çalıştırılmaz. Henüz canlı migration uygulanmış kabul edilmez. Bu başlangıç migration'ı var olan farklı bir şemanın üstüne birleştirme amacı taşımaz.

## Veri modeli ve izinler

| Tablo | İşlev ve sınır |
| --- | --- |
| `profiles` | Hesaba ait tam ad ve görünen ad; kişi kendi profilini, etkin partneri partner profilini okuyabilir. Güncelleme kişinin kendi profilindedir. |
| `couples` | İlişki tarihi ve ortak bitki alanları; iki etkin üye de ortak alanları düzenleyebilir. Eşleşme sonlandırma RPC üzerinden yapılır. |
| `couple_members` | Her kullanıcı için en fazla bir etkin üyelik. İstemcinin üyelik ekleme/silme izni yoktur. İki üyelik kabul işlemi sırasında birlikte oluşturulur. |
| `invitations` | Kriptografik altı karakterli, 24 saat geçerli davet. Bekleyen davet tek başına çift oluşturmaz. Kabul, iptal ve ret atomiktir. |
| `shared_records` | Kategori kimliği, zorunlu `couple_id`, doğrulanan JSON içerik, değişmez ekleyen bilgisi ve artan `version`. |
| `notifications` | Yalnızca alıcı hesabına görünür. İstemci sadece `read` alanını değiştirebilir. Eşleşme ve öpücük olayları sunucuda oluşturulur. |

Ortak içeriklerin görüntüleme, düzenleme ve silme izni kaydı ekleyene göre değil **etkin çift üyeliğine** göre belirlenir. Partner B, A'nın eklediği kaydı düzenleyebilir ve silebilir. Başka çiftin üyesi C bu kayda erişemez. `created_by` yalnızca kaynağı belirtir; istemci bu alanı taklit edemez veya değiştiremez.

Ruh hali, günlük şarkı ve günlük adım kategorilerinde `(couple_id, category, created_by, yerel gün)` benzersizdir. Böylece iki partner aynı gün ayrı kayıt ekleyebilir; bir kişinin aynı güne ikinci kaydı sunucuda reddedilir. Günlük kayıt düzenleme işlemi mevcut kaydın sürümüyle yapılır.

JSON içerik alanları: `title`, `body`, `date`, `time`, `location`, `done`, `items`, `url`, `mood`, `specialDayType`, `price`. Tarih anahtarı `YYYY-MM-DD`, saat `HH:mm` biçimindedir. `calendar`, `special-days`, `mood`, `song`, `steps` için tarih zorunludur. Partner notu 140, ruh hali notu 280 karakterle sınırlıdır. Listelerde madde kimlikleri benzersizdir. Bağlantılar `http` veya `https` kullanır.

Ruh hali arayüzü `mood` alanında gerçek Unicode emojiyi (örneğin `😊`), `title` alanında Türkçe etiketi (`İyi`) saklar. Sunucu bu dokuz emoji seçeneğini ve mevcut etiket biçimini kabul eder; desteklenmeyen duygu değerlerini reddeder.

## İstemci RPC sözleşmesi

| RPC | Sonuç |
| --- | --- |
| `create_invitation()` | Davet satırı; `couple_id` kabulden önce `null` |
| `accept_invitation(invite_code text)` | Oluşturulan çift UUID'si |
| `cancel_invitation(invitation_id uuid)` | `void` |
| `reject_invitation(invite_code text)` | `void` |
| `leave_couple()` | `void`; eski çift kapanır, iki üyenin de eski kayıtlara erişimi sonlanır |
| `update_shared_record(record_id uuid, expected_version integer, record_data jsonb)` | Güncel kayıt satırı ve yeni sürüm |
| `delete_shared_record(record_id uuid, expected_version integer)` | `void` |
| `update_app_profile(profile_patch jsonb, expected_couple uuid default null)` | `void`; görünen ad ve ortak ilişki tarihi tek transaction'da kaydedilir |
| `send_kiss(expected_couple uuid default null)` | `void`; etkin partnerin bildirimini oluşturur |

`update_app_profile` yalnızca `name` ve `relationshipDate` alanlarını kabul eder. Boş tarih ilişki tarihini temizler. Tarih değişikliği için etkin eşleşme gerekir. Eşleşme veya profil kaydı kaybolduysa isim dahil hiçbir kısmi değişiklik başarı kabul edilmez.

İstemci bu iki RPC'ye önbelleğindeki çift kimliğini `expected_couple` olarak geçirir. Başka bir cihazda eşleşme sonlandırılıp yeni partnerle eşleşildiyse eski ekrandan gelen işlem yeni çifte uygulanmaz; `40001` ile yenileme istenir.

Doğrudan `shared_records` güncelleme/silme izni verilmez; iki partner de aynı sürüm kontrolü yapan RPC'leri kullanır. Eski veya eksik sürüm SQLSTATE `40001`, erişim reddi `42501`, geçersiz veri/davet `22023`, günlük yinelenen kayıt veya zaten eşleşmiş kullanıcı `23505` döndürür. Eski sürümde istemci veriyi yenileyip kullanıcıya çakışmayı göstermelidir.

Davet kabulü kullanıcı kimliklerini tutarlı sırada transaction advisory lock ile, davet satırını da satır kilidiyle kontrol eder. Aynı kullanıcıyı iki kez eşleştirmeye karşı veritabanı benzersizlik kısıtı ayrıca korunur. Kodları ve davet ayrıntılarını genel bir listeleme uç noktası açığa çıkarmaz.

## Özel dosyalar

`couple-files` kovası özeldir. Dosya boyutu en fazla **25 MiB**; PDF, Word, desteklenen görsel ve ses MIME türleri kabul edilir. Nesne yolu:

```text
<couple UUID>/<shared record UUID>/<file name>
```

İlk iki yol bileşeni gerçek ve aynı çifte ait bir doküman, galeri veya ses kaydına karşılık gelmelidir. İki partner de dosyayı okuyabilir, değiştirebilir ve silebilir; Storage `owner` alanı yetki belirlemez. Başka çiftler ve bozuk yollar reddedilir. Uygulama dosyaları kısa süreli imzalı bağlantıyla açmalıdır.

Bu ilk sürüm dosya seçme/yükleme ve ses kaydı arayüzlerini henüz etkinleştirmez. Dosya yaşam döngüsü uygulanırken Storage API üzerinden nesne silme ve başarısız yüklemelerin temizliği eklenmelidir; SQL satır silme fiziksel dosyayı silmez. Üst kayıt silinirse kalan nesneye bu politikalarla erişim kapanır. `storage.objects` tablosundan doğrudan SQL silme, fiziksel nesneyi temizlemek yerine yalnızca metaveriyi kaldırdığı için üretim temizliği yöntemi olarak kullanılmaz.

## Doğrulama

Uygulama kökünde:

```sh
npm run test:db
```

Testler gerçek PostgreSQL motorunu (PGlite) geçici bellekte başlatır. `tests/rls.sql` yalnızca Supabase'in `auth` ve `storage` platform tablolarının test kurulumudur; asıl migration, politikalar, tetikleyiciler ve RPC'ler aynen çalıştırılır. Hiçbir ağ bağlantısı veya canlı veritabanı kimlik bilgisi kullanılmaz.

Denetlenen davranışlar arasında B'nin A kaydını okuması/düzenlemesi/silmesi, C'nin kayıt ve Storage erişiminin engellenmesi, eski sürüm çakışması, günlük kayıt tekilliği, iki ayrı şarkı, tarih/uzunluk doğrulaması, eşleşme kabul/ret/iptal/süre sonu, alıcıya özel bildirimler ve eşleşme sonrasında eski içerik izolasyonu bulunur. İmzalı URL'nin Storage HTTP yanıtı, gerçek cihaz Realtime bağlantısı ve çok bağlantılı yarış testleri bu yerel motor testlerinin kapsamına dahil değildir.

Çift üyeliği, profil, bildirim, davet ve ortak kayıt tabloları mevcut `supabase_realtime` yayınına eklenir. Ağ kesilmesi veya uygulamanın ön plana dönmesi durumunda istemci yeniden yükleme yapmalıdır. Kamuya açık kullanım öncesinde davet RPC istek sınırları, e-posta teslimi, Auth yönlendirmeleri ve dosya temizliği işletim ortamında ayrıca yapılandırılır. Hesap silme sunucu akışı bu başlangıç şemasında henüz yoktur.

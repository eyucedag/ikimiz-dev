# Shared preview yayını

Bu proje mevcut EAS projesine bağlıdır:

- Proje kimliği: `6d0fb1e3-3583-4131-8f52-2c356a4066cd`
- Kanal: `shared-preview`
- Runtime: `1.0.0`
- Güncelleme sunucusu: `https://u.expo.dev/6d0fb1e3-3583-4131-8f52-2c356a4066cd`

## Yayımlama

Node.js 22.13 veya üzerini kullanın. Bağımlılıkları `npm ci` ile kurun.
Yayın yetkisi olan Expo hesabının `EXPO_TOKEN` değerini gizli ortam değişkeni
veya Git tarafından dışlanan `.env` dosyası üzerinden sağlayın. Token'ı
`EXPO_PUBLIC_*` değişkenlerine veya uygulama ayarlarına koymayın.

`.env` dosyası `EXPO_PUBLIC_SUPABASE_URL` ve
`EXPO_PUBLIC_SUPABASE_ANON_KEY` değerlerini içermelidir. Yayın komutu bunları
Node üzerinden okur. EAS'in `preview` ortamında aynı isimde tanımlanan
değişkenler varsa sunucudaki değerler önceliklidir. `preview` ortamı
Expo SDK 58 yayını için açıkça seçilir.

```sh
npm run typecheck
npm run lint
npm test
npm run update:preview -- --message "İkimiz ortak önizleme"
```

Bu bulut ortamında Expo ayarlarını yazılabilir proje dizininde tutmak ve
telemetri dizini hatasını önlemek için yayın komutunu şu şekilde çalıştırın:

```sh
EXPO_NO_TELEMETRY=1 __UNSAFE_EXPO_HOME_DIRECTORY="$PWD/.expo-user" CI=1 npm run update:preview -- --message "İkimiz ortak önizleme"
```

Komut kanalın mevcut dal eşlemesini kullanır. Yeni bir Expo projesi oluşturmaz.
İlk canlı yayından önce EAS proje sahibi/slug ve mevcut iOS/Android
güncellemelerinin SDK uyumluluğu doğrulanmalıdır. `runtimeVersion` değerinin
aynı olması tek başına native uyumluluk garantisi değildir. `1.0.0` runtime'ını
kullanan kurulu native uygulamalar SDK 58 ile uyumlu olmalıdır; SDK değişiminde
native derleme ve uygun yeni runtime gerekir.

Yayının tamamlandığını EAS'in döndürdüğü güncelleme grubu kimliği ve her iki
platformun manifestiyle doğrulayın. Sadece export başarısı veya QR oluşturmak
yayın yapıldığı anlamına gelmez. Expo Go'da açılabilmesi, cihazdaki Expo Go'nun
SDK 58 desteğine ve EAS Update/Expo Go erişim koşullarına da bağlıdır.

## Bulut ağ izinleri

EAS Update bir geliştirme tüneli kullanmaz. Başlangıç için gereken hedefler:

- `api.expo.dev`: hesap/proje/kanal ve yayın API'si
- `u.expo.dev`: yayımlanan iOS/Android manifestlerini doğrulama
- `assets.eascdn.net`: yayımlanan paket/varlıkları doğrulama
- `storage.googleapis.com`: API'nin verdiği imzalı dosya yükleme adresleri
- `update-assets-upload-production.storage.googleapis.com`: bu projede API'nin
  döndürdüğü uygulama paketi ve varlık yükleme hedefi

Yayın komutu, Expo'nun `update-assets-upload-production` kovasına ait imzalı
POST form yüklemelerinde Google'ın desteklediği
`https://storage.googleapis.com/update-assets-upload-production/` adresini
kullanır. `scripts/eas-gcs-path.cjs` yalnızca bu kovanın POST form adresini
düzenler; imzalı form alanlarını, proxy'yi ve TLS doğrulamasını korur.
Sorgu parametreleriyle imzalanmış GET/PUT adreslerini değiştirmez.

Yükleme adresleri API tarafından belirlenir. API başka bir yükleme alan adı
döndürürse yalnızca o alan adını izin listesine ekleyin; imzalı URL sorgusunu
veya token'ı paylaşmayın. Proxy `403` verirse ortamın ağ yapılandırmasını
düzenleyin; proxy'yi atlamayın.

Doğrudan `npx eas update` yerine yukarıdaki `npm run update:preview` komutunu
kullanın. Doğrudan komut `eas-gcs-path.cjs` uyarlamasını yüklemez. Bu ortamda
kova alan adı engelliyken `storage.googleapis.com` izinlidir; desteklenen POST
adresi ve Expo'nun verdiği imzalı form alanlarıyla yükleme yapılmalıdır.
`CONNECT tunnel failed, response 403` ile Google'ın XML `AccessDenied` yanıtını
ayırt edin. Proxy hatası, Expo token'ının geçersiz olduğunu göstermez.

## Telefon bağlantısı

```text
exp://u.expo.dev/6d0fb1e3-3583-4131-8f52-2c356a4066cd?runtime-version=1.0.0&channel-name=shared-preview
```

Bu bağlantı mevcut kanalı seçer; kanal yeniden yayımlandığında adres değişmez.
Bu dosyanın veya bağlantının varlığı yeni sürümün yayımlandığını göstermez.

## Son doğrulanan yayın

11 Kasım 2026, 23.48 (Türkiye):

- Güncelleme grubu: `c9c0d098-2dbe-4ec4-be9d-e49d382d7576`
- iOS: `01a1cc5e-8efa-7cd1-8b6d-8686b7e5b74b`
- Android: `01a1cc5e-8efa-7103-a61b-b10d45296ec8`
- Her iki kanal manifesti yeni güncellemeyi, SDK `58.0.0` ve runtime `1.0.0`
  değerlerini döndürdü.
- Manifestteki varlık yetkilendirme başlıklarıyla iki platformun başlangıç
  paketleri CDN'den HTTP 200 ile indirildi. Bu başlıklar olmadan 403 beklenir.
- Tip kontrolü, lint, 20 birim testi, dört ekran testi ve iOS/Android export başarılı.
- Not Defteri ve Partnerinden Not kartları yalnızca başlıkla kapalı başlar.
  Başlığa dokununca tam metin açılır; tekrar dokununca kapanır. Düzenleme
  karttaki kalem düğmesindedir.
- Konum kontrolü: kimse paylaşmıyorsa gri, bir kişi paylaşıyorsa iki telefonda
  mavi, iki kişi paylaşıyorsa yeşil. Ok iki koordinattan hesaplanan yönü kendi
  telefonunun pusulasına göre gösterir; pusula yoksa kuzeye göre gösterildiği
  belirtilir. Ön planda takip sürer; arka planda durur, geri dönünce açık
  paylaşım yeniden başlar. Sabit duran cihazlar da durum güncellemesi gönderir.

Telefonlarda Expo Go içinde açılış ayrıca cihaz üzerinden denenmelidir.

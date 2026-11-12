# İkimiz çalışma notları

- Ürün kapsamı ve son tema için `docs/APP_REFERENCE.md` dosyasını esas alın. Görsel konseptin kodda uygulanmış olduğunu varsaymayın; mevcut uygulamayı okuyun.
- Expo / React Native ve Expo Router yapısını koruyun. Web önizlemesi, aynı native ekranları kullanır.
- Ortak kayıtları `couple_id` kapsamına bağlayın. Her iki etkin partnerin düzenleme/silme hakları eşittir; ekleyen bilgisi yetki sınırı değildir.
- Referanstaki Deniz/Ege, 842 gün ve etkinlikler örneklerdir. Başlangıç verisine sabitlemeyin.
- Tema token'ları `src/constants/theme.ts`, kategori renkleri `src/constants/categories.ts` içindedir. Kategorilerin ayrı renk ailelerini ve açık/koyu ayrımını koruyun.
- Günlük kayıtlar yerel takvim gününü kullanır. Tarihleri UTC dönüşümüyle bir gün kaydırmayın.
- Yerel deneme alanı ile canlı ortak alanı açıkça ayırın. Tamamlanmamış işlemleri başarılı veya kullanılabilir göstermeyin.
- Gereken kontroller: `npm run typecheck`, `npm run lint`, `npm test`; veri/izin değişiminde `npm run test:db`; akış değişiminde `npm run test:ui`; paket/yönlendirme değişiminde Expo export.
- Migration sırası ve canlı kurulum için `supabase/README.md` dosyasını izleyin. Uygulama yayını veritabanı migration'ını kendiliğinden uygulamaz.
- Buluttan EAS yayını için `docs/SHARED_PREVIEW.md` ve `npm run update:preview` komutunu kullanın. Doğrudan `eas update`, bu ortamda engellenen kova alan adına gider. `403` durumunda hesabın rolünü veya token'ı değiştirmeden önce hatanın proxy'den mi uzak servisten mi geldiğini doğrulayın.

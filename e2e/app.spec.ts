import { expect, test, type Page } from '@playwright/test';

async function records(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('ikimiz:local:v1') || '{"records":[]}').records as { category: string; title: string; done?: boolean; items?: {text:string;done:boolean}[] }[]);
}
async function openEditor(page: Page, category: string) {
  await page.goto(`/category/${category}?create=1`);
  await expect(page.getByRole('button', { name: 'Kapat', exact: true })).toBeVisible();
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kapat', exact: true })).toHaveCount(0);
}

test('profil, takvim, listeler ve günlük paylaşımlar yenilemeden sonra korunur', async ({ page }) => {
  const errors: string[]=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.goto('/settings');
  await page.getByLabel('Adın', {exact:true}).fill('Ada');
  await page.getByLabel('Partnerinin adı', {exact:true}).fill('Mert');
  await page.getByLabel('İlişki başlangıcı', {exact:true}).fill('2024-02-14');
  await page.getByRole('button', {name:'Bilgileri kaydet',exact:true}).click();
  await expect(page.getByText('Bilgilerin kaydedildi.',{exact:true})).toBeVisible();
  await page.goto('/');
  await expect(page.getByText(/İyi akşamlar,|Günaydın,|Merhaba,|İyi geceler,/)).toContainText('Ada');
  await expect(page.getByText(/Birlikte \d/)).toBeVisible();

  await openEditor(page,'calendar');
  await page.getByLabel('Başlık',{exact:true}).fill('Birlikte kahve');
  await page.getByLabel('Saat (isteğe bağlı)',{exact:true}).fill('19:30');
  await page.getByLabel('Konum (isteğe bağlı)',{exact:true}).fill('Evde');
  await save(page);
  await expect(page.getByText('Birlikte kahve',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Birlikte kahve',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sonraki ay',exact:true}).click();
  await expect(page.getByText('Birlikte kahve',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Bugüne dön',exact:true}).click();
  await expect(page.getByText('Birlikte kahve',{exact:true})).toBeVisible();

  await openEditor(page,'lists');
  await page.getByLabel('Liste adı',{exact:true}).fill('Haftalık alışveriş');
  await page.getByLabel('Yeni liste maddesi',{exact:true}).fill('Süt');
  await page.getByRole('button',{name:'Madde ekle',exact:true}).click();
  await page.getByLabel('Yeni liste maddesi',{exact:true}).fill('Kahve');
  await save(page);
  await page.getByRole('button',{name:'Haftalık alışveriş listesini aç',exact:true}).click();
  await page.getByRole('checkbox',{name:'Süt',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Süt',exact:true})).toBeChecked();
  await page.getByLabel('Haftalık alışveriş listesine madde ekle',{exact:true}).fill('Ekmek');
  await page.getByRole('button',{name:'Maddeyi ekle',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Ekmek',exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Haftalık alışveriş listesini aç',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Süt',exact:true})).toBeChecked();

  await openEditor(page,'mood');
  await page.getByRole('button',{name:'İyi',exact:true}).click();
  await page.getByLabel('Kısa bir not (isteğe bağlı)',{exact:true}).fill('Güzel bir gündü.');
  await save(page);
  await openEditor(page,'mood');
  await page.getByRole('button',{name:'Harika',exact:true}).click();
  await page.getByRole('button',{name:'Değişiklikleri kaydet',exact:true}).click();
  await expect(page.getByRole('button',{name:'Kapat',exact:true})).toHaveCount(0);
  expect((await records(page)).filter(r=>r.category==='mood')).toHaveLength(1);
  await openEditor(page,'song');
  await page.getByLabel('Şarkı adı',{exact:true}).fill('Gülümse');
  await page.getByLabel('Sanatçı',{exact:true}).fill('Sezen Aksu');
  await save(page);
  await page.goto('/');
  await expect(page.getByText('Harika',{exact:false})).toBeVisible();
  await expect(page.getByText('Gülümse',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('düzenleme, silme onayı ve güvenli bağlantı doğrulaması çalışır',async({page})=>{
  await openEditor(page,'notebook');
  await page.getByLabel('Başlık',{exact:true}).fill('Tatil fikri');
  await page.getByLabel('Notun',{exact:true}).fill('Birlikte Kapadokya.');
  await save(page);
  await expect(page.getByText('Birlikte Kapadokya.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Tatil fikri notunu aç',exact:true}).click();
  await expect(page.getByText('Birlikte Kapadokya.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Kapat',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Tatil fikri notunu kapat',exact:true}).click();
  await expect(page.getByText('Birlikte Kapadokya.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Tatil fikri kaydını düzenle',exact:true}).click();
  await expect(page.getByLabel('Notun',{exact:true})).toHaveValue('Birlikte Kapadokya.');
  await page.getByLabel('Başlık',{exact:true}).fill('Tatil planı');
  await page.getByRole('button',{name:'Değişiklikleri kaydet',exact:true}).click();
  await expect(page.getByText('Tatil planı',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Tatil planı kaydını sil',exact:true}).click();
  await page.getByRole('button',{name:'Vazgeç',exact:true}).click();
  await expect(page.getByText('Tatil planı',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Tatil planı kaydını sil',exact:true}).click();
  await page.getByRole('button',{name:'Kaydı sil',exact:true}).click();
  await expect(page.getByText('Tatil planı',{exact:true})).toHaveCount(0);

  await openEditor(page,'partner-note');
  await page.getByLabel('Notun',{exact:true}).fill('Akşam birlikte bir yürüyüş yapalım.');
  await page.getByRole('button',{name:'Notu bırak',exact:true}).click();
  await expect(page.getByRole('button',{name:'Kapat',exact:true})).toHaveCount(0);
  await expect(page.getByText('Akşam birlikte bir yürüyüş yapalım.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Sana bir not notunu aç',exact:true}).click();
  await expect(page.getByText('Akşam birlikte bir yürüyüş yapalım.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sana bir not notunu kapat',exact:true}).click();
  await expect(page.getByText('Akşam birlikte bir yürüyüş yapalım.',{exact:true})).toHaveCount(0);

  await openEditor(page,'documents');
  await page.getByLabel('Görünen ad',{exact:true}).fill('Ortak bağlantı');
  await page.getByLabel('Bağlantı adresi',{exact:true}).fill('javascript:alert(1)');
  await page.getByRole('button',{name:'Kaydet',exact:true}).click();
  await expect(page.getByText('http:// veya https:// ile başlayan geçerli bir bağlantı yaz.',{exact:true})).toBeVisible();
  expect((await records(page)).filter(r=>r.category==='documents')).toHaveLength(0);
  await page.getByLabel('Bağlantı adresi',{exact:true}).fill('https://example.com');
  await save(page);
  await expect(page.getByText('Ortak bağlantı',{exact:true})).toBeVisible();

  await openEditor(page,'tasks');
  await page.getByLabel('Başlık',{exact:true}).fill('Bitkiyi sulamak');
  await save(page);
  await page.getByRole('checkbox',{name:'Bitkiyi sulamak tamamlandı olarak işaretle',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Bitkiyi sulamak tamamlanmadı olarak işaretle',exact:true})).toBeChecked();
});

test('ana ekran tercihleri, bitki ve öpücük önizlemesi kalıcı ve açık davranır',async({page})=>{
 await page.goto('/customize');
 await page.getByRole('switch',{name:'Galeri kartını göster',exact:true}).uncheck();
 await expect(page.getByRole('switch',{name:'Galeri kartını göster',exact:true})).not.toBeChecked();
 await page.getByRole('button',{name:'Partnerinden Not kartını yukarı taşı',exact:true}).click();
 await page.getByRole('radio',{name:'Kaktüs',exact:true}).click();
 await expect(page.getByRole('radio',{name:'Kaktüs',exact:true})).toBeChecked();
 await page.reload();
 await expect(page.getByRole('switch',{name:'Galeri kartını göster',exact:true})).not.toBeChecked();
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Galeri',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Ortak bitkinizle ilgilenin',exact:true}).click();
 await expect(page.getByText('Kaktüs',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Biraz su ver',exact:true}).click();
 await expect(page.getByText('Bugünkü sulaman tamamlandı. Partnerinin bakımıyla birlikte daha hızlı büyüyecek!',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Bitkiyi değiştir',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Öpücük animasyonunu dene',exact:true}).click();
 await expect(page.getByText('Bu, yalnızca bu cihazda bir önizleme.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Kapat',exact:true}).click();
 await page.goto('/categories');
 await expect(page.getByRole('button',{name:'Galeri',exact:true})).toBeVisible();
 await page.goto('/auth');
 await expect(page.getByText('Ortak yuvanıza hazırlanıyoruz',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Giriş yap',exact:true})).toHaveCount(0);
});

test('telefon ve tablet yönlerinde taşma ve çalışma zamanı hatası yok',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const viewport of [{width:360,height:800},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}]){
  await page.setViewportSize(viewport);
  for(const route of ['/','/categories','/category/calendar','/customize','/settings']){
   await page.goto(route);
   await expect(page.locator('body')).not.toBeEmpty();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
 }
 expect(errors).toEqual([]);
});

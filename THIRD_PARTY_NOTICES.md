# Üçüncü taraf bileşenler ve lisanslar

Bu proje aşağıdaki açık kaynak yazılımları, yazı tiplerini, ikonları ve fotoğrafları kullanır.
Her bileşen kendi lisansına tabidir.

## Çalışma zamanı bağımlılıkları (npm)

| Paket | Lisans | Kullanım |
|---|---|---|
| react, react-dom | MIT | Menü ve yönetim paneli arayüzü (sunucuda SSR + tarayıcıda hydrate) |
| react-icons | MIT | Arayüz ikonları (Lucide ikonları — ISC; WhatsApp ikonu — Font Awesome Free, [CC BY 4.0](https://fontawesome.com/license/free)) |
| sharp (libvips) | Apache-2.0 (libvips: LGPL-3.0-or-later) | Görsel işleme: WebP varyantları, EXIF silme, QR PNG |
| zod | MIT | İstemci ve sunucuda ortak doğrulama şemaları |

## Geliştirme bağımlılıkları

esbuild (MIT), tailwindcss (MIT), typescript (Apache-2.0), tsx (MIT), playwright (Apache-2.0), @types/* (MIT).

## Projeye dahil edilmiş kodlar

| Dosya | Kaynak | Lisans |
|---|---|---|
| `src/server/vendor/qrcodegen.ts` | [Project Nayuki — QR Code generator library](https://www.nayuki.io/page/qr-code-generator-library) | MIT (dosya başında) |
| `tests/vendor/jsQR.cjs` (yalnızca testlerde, QR doğrulaması) | [cozmo/jsQR](https://github.com/cozmo/jsQR) 1.4.0 | Apache-2.0 (`tests/vendor/LICENSE-jsQR.txt`) |

## Yazı tipleri (`public/fonts`)

| Yazı tipi | Lisans |
|---|---|
| Poppins (varsayılan menü yazı tipi) | SIL Open Font License 1.1 — `LICENSE-poppins.txt` |
| Manrope (yönetim paneli, "Modern" seçeneği) | SIL Open Font License 1.1 — `LICENSE-manrope.txt` |
| Fraunces ("Klasik" seçeneği) | SIL Open Font License 1.1 — `LICENSE-fraunces.txt` |

## Kategori ikonları (`public/ikonlar`)

Renkli 3B kategori ikonları [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) setinden
alınmış, 128 px WebP olarak küçültülmüştür. Lisans: MIT — `public/ikonlar/LICENSE-fluent-emoji.txt`.

## Örnek menü fotoğrafları (`ornek-veriler/fotograflar`)

Örnek restoranın fotoğrafları Wikimedia Commons'tan, belirtilen özgür lisanslarla alınmıştır. Tümü
kırpılmış, yeniden boyutlandırılmış ve sıkıştırılmıştır; kapak fotoğrafına ayrıca renk düzeltmesi yapılmıştır.
Fotoğraf sahipleri menüde de gösterilir (ürün detayında ve alt bilgideki **Fotoğraf kaynakları** bağlantısında).
Makine tarafından okunabilir liste: `ornek-veriler/fotograflar/kaynaklar.json`.

CC BY-SA lisanslı fotoğrafların değiştirilmiş hâlleri aynı lisansla (CC BY-SA, ilgili sürüm) paylaşılır.
Bu fotoğraflar yalnızca örnek/tanıtım içindir; canlı kullanımda restoranın kendi fotoğraflarıyla değiştirilmesi önerilir.

| Dosya | Fotoğrafçı | Lisans | Kaynak |
|---|---|---|---|
| `acili-tavuk-kanat.jpg` | Shelby L. Bell | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Hot_Wings_-_The_Session_Room_-_Omaha,_NE_(In_Explore_03-06-18)_-_Flickr_-_vwcampin.jpg) |
| `avokadolu-eksi-maya-tost.jpg` | Sarah Stierch | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Avocado_toast_at_the_girl_%26_the_fig_-_Sarah_Stierch.jpg) |
| `avokadolu-kinoa-kasesi.jpg` | terri_bateman | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Kaynak](https://commons.wikimedia.org/wiki/File:-365_power_bowl_(26679400346).jpg) |
| `bonfile-ve-patates.jpg` | Daderot | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Kaynak](https://commons.wikimedia.org/wiki/File:Steak_frites_-_Boston,_Massachusetts.jpg) |
| `cheeseburger.jpg` | Renee Comet (photographer) | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) | [Kaynak](https://commons.wikimedia.org/wiki/File:Cheeseburger.jpg) |
| `dana-antrikot.jpg` | danielhallpresentsdotcom | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Ribeye_steak_and_asparagus.jpg) |
| `dondurma-kupasi.jpg` | Willis Lam | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Ben_and_Jerry%27s_Hot_Fudge_Sundae_(19384608984).jpg) |
| `double-cheeseburger.jpg` | Evan-Amos | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:McDonald%27s_McDouble_burger.jpg) |
| `ege-salatasi.jpg` | User:Jpatokal | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Greece_Food_Horiatiki.JPG) |
| `et-durum.jpg` | Vis M | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Plate_Shawarma_-_variant.jpg) |
| `falafel-ve-humus-tabagi.jpg` | Charles Haynes | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Mixed_Plate_(3186676853).jpg) |
| `firin-musakka.jpg` | Robert Kindermann aka RobertK | [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5) | [Kaynak](https://commons.wikimedia.org/wiki/File:MussakasMeMelitsanesKePatates01.JPG) |
| `firinda-dana-incik.jpg` | Mogens Engelund | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Ossobuco.jpg) |
| `firinda-sogan-corbasi.jpg` | Daderot | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Kaynak](https://commons.wikimedia.org/wiki/File:French_onion_soup_-_Boston,_MA.jpg) |
| `iskender-kebap.jpg` | E4024 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Hac%C4%B1bey_fileto.jpg) |
| `izgara-tavuk.jpg` | Devika | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Tandoori_platter_(8523839336).jpg) |
| `kapak.jpg` | Jon Sullivan | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) | [Kaynak](https://commons.wikimedia.org/wiki/File:Ribeyes.jpeg) |
| `karides-sis.jpg` | Paul Lowry | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Grilled_Shrimp_Kebab_and_Basmati_Rice,_Saba_New_Orleans_April_2025.jpg) |
| `karisik-izgara.jpg` | Elisart | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:PinchosAmericanos.jpg) |
| `kulah-dondurma.jpg` | TheCulinaryGeek | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Strawberry_ice_cream_cone_(5076899310).jpg) |
| `lahmacun.jpg` | Rainer Zenz | [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/) | [Kaynak](https://commons.wikimedia.org/wiki/File:Lahmacun.jpg) |
| `latte.jpg` | Ladabohac | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Kaynak](https://commons.wikimedia.org/wiki/File:Zlat%C3%A9_cappuccino_v_A-Caffe_v_Gomelu.jpg) |
| `mantarli-burger.jpg` | jeffreyw | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Mushroom_Swiss_burger_on_an_onion_roll.jpg) |
| `muzlu-dondurma-tabagi.jpg` | Edward Allen Lim | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Banana_split_1.jpg) |
| `peynirli-biber-dolmasi.jpg` | Daderot | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Kaynak](https://commons.wikimedia.org/wiki/File:Bell_pepper,_stuffed_with_tuna_fish_and_refried_beans,_baked,_with_camembert_cheese,_olive_oil,_and_black_pepper_-_Massachusetts.jpg) |
| `philly-steak-sandvic.jpg` | ZhengZhou | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Philly_cheesesteak_with_french_fries.jpg) |
| `sahanda-saksuka.jpg` | Calliopejen1 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Shakshuka_by_Calliopejen1.jpg) |
| `soguk-kahve.jpg` | Morio | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:Coffee_float_and_ice_cream_soda_2017_Ginza_Renoir_1.jpg) |
| `tarcinli-fransiz-tostu.jpg` | Jonathunder | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Kaynak](https://commons.wikimedia.org/wiki/File:FrenchToast.JPG) |

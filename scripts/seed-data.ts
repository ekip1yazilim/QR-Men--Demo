/**
 * Örnek restoran ve menü verileri.
 * Kendi restoranınız için bu dosyayı düzenleyip `npm run seed -- --sifirla` çalıştırabilir
 * ya da her şeyi yönetim panelinden değiştirebilirsiniz.
 *
 * `photo`: ornek-veriler/fotograflar/<ad>.jpg dosyası (Wikimedia Commons; yazar ve lisans
 * bilgileri aynı klasördeki kaynaklar.json dosyasındadır ve menüde gösterilir).
 */
import type { StoredRestaurant } from "../src/server/repo/settings";
import type { BadgeKey, WeekHours } from "../src/shared/types";

export const SAMPLE_RESTAURANT: StoredRestaurant = {
  name: "Lezzet Durağı",
  brandLabel: "RESTAURANT",
  heroTitle: "Eşsiz Lezzetler Sizi Bekliyor",
  tagline: "Taze malzemelerle hazırlanan özel tariflerimizle unutulmaz bir deneyim yaşayın.",
  description:
    "2009'dan beri aynı ocakta, aynı özenle. Etlerimizi her sabah kendi kasabımızdan alıyor, meşe kömüründe pişiriyoruz. Ekmeğimiz taş fırınımızdan, salatalarımız günün sebzelerinden.",
  phone: "+90 555 123 45 67",
  whatsapp: "+90 555 123 45 67",
  email: "info@lezzetduragi.com",
  address: "Atatürk Caddesi No:123, Kadıköy, İstanbul",
  mapsUrl: "",
  instagram: "@lezzetduragi",
  hours: [
    { closed: false, open: "11:00", close: "23:00" },
    { closed: false, open: "11:00", close: "23:00" },
    { closed: false, open: "11:00", close: "23:00" },
    { closed: false, open: "11:00", close: "23:00" },
    { closed: false, open: "11:00", close: "00:30" },
    { closed: false, open: "10:00", close: "00:30" },
    { closed: false, open: "10:00", close: "22:00" },
  ] satisfies WeekHours,
  hoursNote: "Mutfağımız kapanıştan 45 dakika önce sipariş almayı bırakır.",
  footerNote: "Tüm fiyatlarımıza KDV dahildir. Servis ücreti alınmaz.",
  logoImageId: null,
  coverImageId: null,
};

/** Kapak fotoğrafı (ornek-veriler/fotograflar/kapak.jpg) */
export const SAMPLE_COVER_PHOTO = "kapak";

interface SampleProduct {
  name: string;
  description: string;
  price: number;
  photo?: string;
  featured?: boolean;
  soldOut?: boolean;
  badges?: BadgeKey[];
  allergens?: string;
  calories?: number;
}

export const SAMPLE_MENU: { name: string; icon: string; description: string; products: SampleProduct[] }[] = [
  {
    name: "Başlangıçlar",
    icon: "fries",
    description: "Sofraya ilk gelenler: çorbalar, mezeler ve sıcak başlangıçlar.",
    products: [
      {
        name: "Fırında Soğan Çorbası",
        description: "Karamelize soğan ve et suyu; üzerinde fırında eritilmiş kaşar peyniri ile.",
        price: 110,
        photo: "firinda-sogan-corbasi",
        allergens: "Gluten, süt ürünleri",
        calories: 320,
      },
      {
        name: "Falafel ve Humus Tabağı",
        description: "Çıtır falafel, humus, tabule ve közlenmiş biber; sıcak pide ile.",
        price: 165,
        photo: "falafel-ve-humus-tabagi",
        badges: ["vejetaryen"],
        allergens: "Susam, gluten",
      },
      {
        name: "Peynirli Biber Dolması",
        description: "Fırında közlenmiş kapya biber; peynir, taze otlar ve zeytinyağı ile.",
        price: 140,
        photo: "peynirli-biber-dolmasi",
        badges: ["vejetaryen", "glutensiz"],
        allergens: "Süt ürünleri",
      },
      {
        name: "Sahanda Şakşuka",
        description: "Domates ve biber sosunda pişmiş yumurtalar, taze maydanoz ile; döküm tavada servis edilir.",
        price: 150,
        photo: "sahanda-saksuka",
        badges: ["vejetaryen"],
        allergens: "Yumurta",
      },
    ],
  },
  {
    name: "Ana Yemekler",
    icon: "pan",
    description: "Ev usulü pişirilen, günün tencere ve fırın yemekleri.",
    products: [
      {
        name: "İskender Kebap",
        description: "Pide üzerinde ince dilim döner, tereyağlı domates sosu ve yoğurt ile.",
        price: 340,
        photo: "iskender-kebap",
        badges: ["sef"],
        allergens: "Gluten, süt ürünleri",
        calories: 950,
      },
      {
        name: "Fırın Musakka",
        description: "Patlıcan, kıymalı harç ve beşamel sos; fırında katman katman pişirilir.",
        price: 260,
        photo: "firin-musakka",
        allergens: "Gluten, süt ürünleri, yumurta",
        calories: 720,
      },
      {
        name: "Lahmacun",
        description: "İnce hamur üzerinde zırh kıymalı harç; maydanoz, soğan ve limon ile.",
        price: 120,
        photo: "lahmacun",
        allergens: "Gluten",
        calories: 480,
      },
      {
        name: "Et Dürüm",
        description: "Lavaşa sarılı ızgara et döner, patates kızartması ve ev yapımı sos ile.",
        price: 230,
        photo: "et-durum",
        allergens: "Gluten, yumurta",
        calories: 820,
      },
      {
        name: "Fırında Dana İncik",
        description: "Ağır ateşte sebzelerle pişmiş dana incik; döküm tencerede servis edilir.",
        price: 420,
        photo: "firinda-dana-incik",
        soldOut: true,
        allergens: "Kereviz, gluten (un)",
        calories: 780,
      },
    ],
  },
  {
    name: "Izgaralar",
    icon: "beef",
    description: "Meşe kömüründe, siparişinizle birlikte pişirilir. Tüm ızgaralar köz biber, domates ve lavaş ile servis edilir.",
    products: [
      {
        name: "Izgara Tavuk",
        description: "Kekik ve sarımsakla marine edilmiş tavuk; lavaş, soğan ve közlenmiş biber ile.",
        price: 180,
        photo: "izgara-tavuk",
        featured: true,
        allergens: "Süt ürünleri (marine sosu)",
        calories: 540,
      },
      {
        name: "Dana Antrikot",
        description: "250 gr dinlendirilmiş dana antrikot, ızgara kuşkonmaz ile.",
        price: 320,
        photo: "dana-antrikot",
        featured: true,
        badges: ["sef"],
        calories: 710,
      },
      {
        name: "Karışık Izgara",
        description: "Kuzu şiş, tavuk şiş ve sebze şişleri; bulgur pilavı ile. İki kişiliktir.",
        price: 350,
        photo: "karisik-izgara",
        featured: true,
        allergens: "Gluten",
        calories: 1450,
      },
      {
        name: "Bonfile ve Patates",
        description: "Izgara dana bonfile, çıtır patates kızartması ve ev yapımı biber sosu.",
        price: 390,
        photo: "bonfile-ve-patates",
        calories: 880,
      },
      {
        name: "Karides Şiş",
        description: "Sarımsaklı tereyağında marine edilmiş jumbo karidesler; nar taneli bulgur pilavı ile.",
        price: 360,
        photo: "karides-sis",
        badges: ["yeni"],
        allergens: "Kabuklu deniz ürünleri, süt ürünleri",
      },
      {
        name: "Acılı Tavuk Kanat",
        description: "Acı soslu çıtır kanatlar, yoğurtlu dip sos ve kereviz ile.",
        price: 210,
        photo: "acili-tavuk-kanat",
        badges: ["aci"],
        allergens: "Süt ürünleri",
        calories: 690,
      },
    ],
  },
  {
    name: "Burgerler",
    icon: "sandwich",
    description: "Günlük çekilen 160 gr dana köfte, ev yapımı brioche ekmek. Yanında çıtır patates.",
    products: [
      {
        name: "Cheeseburger",
        description: "Dana köfte, cheddar peyniri, marul ve ev yapımı burger sosu.",
        price: 220,
        photo: "cheeseburger",
        featured: true,
        allergens: "Gluten, süt ürünleri, yumurta, hardal",
        calories: 920,
      },
      {
        name: "Mantarlı Burger",
        description: "Dana köfte, sotelenmiş mantar ve eritilmiş İsviçre peyniri; patates kızartması ile.",
        price: 245,
        photo: "mantarli-burger",
        allergens: "Gluten, süt ürünleri",
        calories: 960,
      },
      {
        name: "Double Cheeseburger",
        description: "İki ince dana köfte, çift cheddar ve kornişon turşu.",
        price: 275,
        photo: "double-cheeseburger",
        badges: ["yeni"],
        allergens: "Gluten, süt ürünleri, hardal",
        calories: 1120,
      },
      {
        name: "Philly Steak Sandviç",
        description: "İnce dilim dana bonfile, karamelize soğan ve eritilmiş peynir; baget ekmekte.",
        price: 260,
        photo: "philly-steak-sandvic",
        allergens: "Gluten, süt ürünleri",
        calories: 890,
      },
    ],
  },
  {
    name: "Salatalar",
    icon: "salad",
    description: "Günün sebzeleri, soğuk sıkım zeytinyağı ve ev yapımı soslarla.",
    products: [
      {
        name: "Ege Salatası",
        description: "Domates, salatalık, yeşil biber, kırmızı soğan ve beyaz peynir; kekikli zeytinyağı ile.",
        price: 150,
        photo: "ege-salatasi",
        badges: ["vejetaryen", "glutensiz"],
        allergens: "Süt ürünleri",
      },
      {
        name: "Avokadolu Kinoa Kasesi",
        description: "Kinoa, avokado, turp, közlenmiş tatlı patates ve nar ekşili sos.",
        price: 175,
        photo: "avokadolu-kinoa-kasesi",
        badges: ["vegan", "glutensiz"],
      },
      {
        name: "Avokadolu Ekşi Maya Tost",
        description: "Ekşi maya ekmek üzerinde avokado ezmesi, turşu kırmızı soğan ve mevsim yeşillikleri.",
        price: 160,
        photo: "avokadolu-eksi-maya-tost",
        badges: ["vejetaryen"],
        allergens: "Gluten",
      },
    ],
  },
  {
    name: "Tatlılar",
    icon: "dessert",
    description: "Günlük olarak mutfağımızda hazırlanır.",
    products: [
      {
        name: "Muzlu Dondurma Tabağı",
        description: "Üç top dondurma, muz, çikolata sosu, krem şanti ve vişne.",
        price: 170,
        photo: "muzlu-dondurma-tabagi",
        allergens: "Süt ürünleri",
      },
      {
        name: "Dondurma Kupası",
        description: "Vanilyalı ve çikolatalı dondurma, sıcak çikolata sosu ve krem şanti.",
        price: 150,
        photo: "dondurma-kupasi",
        allergens: "Süt ürünleri",
      },
      {
        name: "Külah Dondurma",
        description: "Çilekli dondurma, çıtır waffle külahta.",
        price: 90,
        photo: "kulah-dondurma",
        allergens: "Süt ürünleri, gluten",
      },
      {
        name: "Tarçınlı Fransız Tostu",
        description: "Tereyağında kızartılmış brioche, tarçın ve pudra şekeri; bal ile.",
        price: 140,
        photo: "tarcinli-fransiz-tostu",
        allergens: "Gluten, süt ürünleri, yumurta",
      },
    ],
  },
  {
    name: "İçecekler",
    icon: "cupsoda",
    description: "",
    products: [
      { name: "Latte", description: "Çift shot espresso ve buharda ısıtılmış süt.", price: 85, photo: "latte", allergens: "Süt ürünleri" },
      { name: "Soğuk Kahve", description: "Soğuk demleme kahve, bir top vanilyalı dondurma ile.", price: 110, photo: "soguk-kahve", allergens: "Süt ürünleri" },
      { name: "Ayran", description: "Yayık ayranı, bakır maşrapada.", price: 45, allergens: "Süt ürünleri" },
      { name: "Türk Kahvesi", description: "Közde pişirilir, lokum ile.", price: 70 },
      { name: "Demlik Çay", description: "İki kişilik, ince belli bardakta.", price: 60 },
      { name: "Taze Sıkma Portakal Suyu", description: "33 cl, siparişle birlikte sıkılır.", price: 85 },
      { name: "Maden Suyu", description: "Sade veya limonlu.", price: 35 },
    ],
  },
];

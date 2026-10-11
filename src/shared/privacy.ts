/**
 * Müşteri menüsündeki "Gizlilik ve çerezler" metni.
 * Yönetim → Genel Ayarlar'da özel metin girilmezse bu varsayılan metin gösterilir. Metin, yazılımın
 * gerçek davranışını anlatır: menü çerez kullanmaz, üçüncü taraf hizmet yüklemez, görüntülenmeler
 * kimliksiz sayılır. Hukuki metinlerinizi bir uzmana kontrol ettirmeniz önerilir.
 */
import type { RestaurantInfo } from "./types";

type Contact = Pick<RestaurantInfo, "name" | "address" | "email" | "phone">;

export function defaultPrivacyNotice(r: Contact): string {
  const name = r.name.trim() || "Restoranımız";
  const contact = [r.email, r.phone, r.address].map((v) => v.trim()).filter(Boolean);
  return [
    `${name} olarak kişisel verilerinizin korunmasına önem veriyoruz. Bu metin, dijital menümüzü kullanırken hangi bilgilerin işlendiğini 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında açıklar.`,
    "",
    "Çerezler",
    "Dijital menümüz çerez kullanmaz. Reklam, pazarlama veya kişi takibi yapan bir araç bulunmaz; harici yazı tipi, sosyal medya eklentisi veya analiz aracı gibi üçüncü taraf hizmetler yüklenmez.",
    "",
    "Anonim görüntülenme sayısı",
    "Menünün ve ürünlerin kaç kez görüntülendiği, kim olduğunuz bilinmeden yalnızca toplam sayı olarak tutulur. Aynı ziyaretin iki kez sayılmaması için tarayıcınızın oturum belleğine kişisel veri içermeyen bir işaret yazılır; bu işaret sekmeyi kapattığınızda silinir.",
    "",
    "Teknik kayıtlar",
    "Menünün güvenli ve kesintisiz çalışması için sunucumuz bağlantı bilgilerinizi (IP adresi, tarih ve saat, açılan sayfa) teknik kayıtlarda sınırlı bir süre tutabilir. Bu bilgiler KVKK'nın 5/2-f maddesi (meşru menfaat) kapsamında yalnızca güvenlik ve hata giderme amacıyla işlenir; yasal zorunluluklar dışında kimseyle paylaşılmaz.",
    "",
    "Dış bağlantılar",
    "WhatsApp, telefon, harita veya Instagram bağlantılarına dokunduğunuzda ilgili uygulama ya da site açılır; bu hizmetlerin kendi gizlilik kuralları geçerlidir.",
    "",
    "Haklarınız",
    `KVKK'nın 11. maddesi uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme haklarına sahipsiniz.${contact.length ? ` Başvurularınız için: ${contact.join(" · ")}` : ""}`,
    "",
    `Veri sorumlusu: ${name}${r.address.trim() ? `, ${r.address.trim()}` : ""}`,
  ].join("\n");
}

/** Metindeki tek satırlık, nokta ile bitmeyen kısa satırlar ara başlık olarak gösterilir */
export function isNoticeHeading(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && t.length <= 40 && !/[.;,!?]$/.test(t) && !t.includes(":") && !t.includes(". ");
}

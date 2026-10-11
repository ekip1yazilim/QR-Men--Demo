/**
 * Yönetici hesabı komutları (sunucu üzerinde çalıştırılır):
 *
 *   npm run admin -- liste
 *   npm run admin -- olustur --email ali@ornek.com --ad "Ali Yılmaz" [--sifre "GüçlüŞifre123"]
 *   npm run admin -- sifre   --email ali@ornek.com [--sifre "YeniŞifre123"]
 *   npm run admin -- sil     --email ali@ornek.com
 *
 * --sifre verilmezse güçlü bir rastgele şifre üretilip ekrana yazılır.
 * Şifre sıfırlandığında o kullanıcının tüm oturumları kapatılır.
 */
import { config } from "../src/server/config";
import { db, openDb } from "../src/server/db";
import { generatePassword, hashPassword } from "../src/server/auth/password";
import { destroyOtherSessions } from "../src/server/auth/session";
import { countUsers, createUser, findUserByEmail, listUsers, updateUserPassword } from "../src/server/repo/users";
import { PASSWORD_MIN } from "../src/shared/schemas";

const [command, ...rest] = process.argv.slice(2);
function opt(name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
}

function checkPassword(p: string) {
  if (p.length < PASSWORD_MIN || !/\d/.test(p) || !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(p)) {
    throw new Error(`Şifre en az ${PASSWORD_MIN} karakter olmalı ve harf ile rakam içermelidir.`);
  }
}

async function main() {
  openDb(config.dbFile);
  switch (command) {
    case "liste": {
      const users = listUsers();
      if (!users.length) console.log("Kayıtlı yönetici yok.");
      for (const u of users) console.log(`#${u.id}  ${u.email}  (${u.name})`);
      break;
    }
    case "olustur": {
      const email = opt("email")?.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Geçerli bir --email girin.");
      if (findUserByEmail(email)) throw new Error("Bu e-posta ile kayıtlı bir yönetici zaten var.");
      const password = opt("sifre") ?? generatePassword();
      checkPassword(password);
      createUser(email, opt("ad") ?? "Restoran Yöneticisi", await hashPassword(password));
      console.log(`✔ Yönetici oluşturuldu: ${email}${opt("sifre") ? "" : `\n  Şifre: ${password}`}`);
      break;
    }
    case "sifre": {
      const email = opt("email")?.trim().toLowerCase();
      const user = email ? findUserByEmail(email) : undefined;
      if (!user) throw new Error("Bu e-posta ile kayıtlı yönetici bulunamadı. (npm run admin -- liste)");
      const password = opt("sifre") ?? generatePassword();
      checkPassword(password);
      updateUserPassword(user.id, await hashPassword(password));
      const closed = destroyOtherSessions(user.id, null);
      console.log(`✔ Şifre güncellendi: ${user.email}${opt("sifre") ? "" : `\n  Yeni şifre: ${password}`}\n  Kapatılan oturum: ${closed}`);
      break;
    }
    case "sil": {
      const email = opt("email")?.trim().toLowerCase();
      const user = email ? findUserByEmail(email) : undefined;
      if (!user) throw new Error("Bu e-posta ile kayıtlı yönetici bulunamadı. (npm run admin -- liste)");
      if (countUsers() <= 1) throw new Error("Son yönetici hesabı silinemez. Önce yeni bir yönetici oluşturun.");
      db().run("DELETE FROM users WHERE id = ?", user.id);
      console.log(`✔ Yönetici silindi: ${user.email} (tüm oturumları kapatıldı)`);
      break;
    }
    default:
      console.log(`Kullanım:
  npm run admin -- liste
  npm run admin -- olustur --email ali@ornek.com --ad "Ali Yılmaz" [--sifre "..."]
  npm run admin -- sifre --email ali@ornek.com [--sifre "..."]
  npm run admin -- sil --email ali@ornek.com`);
  }
}

main().catch((err) => {
  console.error("Hata:", err instanceof Error ? err.message : err);
  process.exit(1);
});

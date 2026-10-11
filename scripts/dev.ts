/**
 * Geliştirme sunucusu: src/ değiştikçe istemci paketlerini ve CSS'i yeniden derler,
 * sunucu kodu değişince sunucuyu yeniden başlatır.
 */
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { buildClient, copyPublic, ROOT } from "./build";

await copyPublic();
await buildClient(true);
console.log("✔ İstemci derlendi (geliştirme modu)");

let timer: NodeJS.Timeout | undefined;
let building = false;
let again = false;
async function rebuild() {
  if (building) {
    again = true;
    return;
  }
  building = true;
  try {
    await buildClient(true);
    console.log(`↻ İstemci yeniden derlendi (${new Date().toLocaleTimeString("tr-TR")})`);
  } catch (err) {
    console.error("Derleme hatası:", err instanceof Error ? err.message : err);
  } finally {
    building = false;
    if (again) {
      again = false;
      void rebuild();
    }
  }
}

// Sunucu dosyaları da Tailwind sınıfı içerebildiği için src/ altındaki her değişiklikte derlenir
watch(path.join(ROOT, "src"), { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => void rebuild(), 150);
});

const server = spawn(path.join(ROOT, "node_modules", ".bin", "tsx"), ["watch", "--clear-screen=false", "src/server/index.ts"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --disable-warning=ExperimentalWarning`.trim() },
});
const stop = () => {
  server.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

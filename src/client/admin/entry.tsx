import { createRoot } from "react-dom/client";
import type { AdminBoot } from "../../shared/types";
import { App } from "./App";
import { setCsrf } from "./lib/api";

const el = document.getElementById("yonetim-veri");
const root = document.getElementById("admin");
if (el && root) {
  const boot = JSON.parse(el.textContent || "{}") as AdminBoot;
  setCsrf(boot.csrf);
  root.innerHTML = "";
  createRoot(root).render(<App initial={boot} />);
}

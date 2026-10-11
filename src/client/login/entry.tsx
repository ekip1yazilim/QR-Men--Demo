import { hydrateRoot } from "react-dom/client";
import { LoginPage, type LoginProps } from "./LoginPage";

const el = document.getElementById("giris-veri");
const root = document.getElementById("app");
if (el && root) {
  const props = JSON.parse(el.textContent || "{}") as LoginProps;
  hydrateRoot(root, <LoginPage {...props} />);
}

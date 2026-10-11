import { hydrateRoot } from "react-dom/client";
import { MenuApp, type MenuAppProps } from "./MenuApp";

const el = document.getElementById("menu-veri");
const root = document.getElementById("app");
if (el && root) {
  const props = JSON.parse(el.textContent || "{}") as MenuAppProps;
  hydrateRoot(root, <MenuApp {...props} />);
}

/** Yönetim paneli kabuğu: istemci tarafı uygulama burada açılır */
import { html, type Ctx } from "../http/core";
import { renderDocument } from "../render/document";
import { getRestaurant } from "../repo/settings";
import { menuUrlFor } from "./admin";
import type { AdminBoot } from "../../shared/types";

/** JS yüklenene kadar görünen iskelet (boş ekran yerine) */
const SKELETON = `
<div class="flex min-h-dvh">
  <aside class="hidden w-[17rem] shrink-0 bg-coal lg:block"></aside>
  <div class="flex-1 p-6 lg:p-10">
    <div class="skeleton h-8 w-48"></div>
    <div class="mt-8 grid gap-4 sm:grid-cols-3">
      <div class="skeleton h-28"></div><div class="skeleton h-28"></div><div class="skeleton h-28"></div>
    </div>
    <div class="skeleton mt-6 h-72"></div>
  </div>
</div>
<noscript><p style="padding:2rem;text-align:center">Yönetim paneli için tarayıcınızda JavaScript etkin olmalıdır.</p></noscript>`;

export function adminShell(ctx: Ctx): Response {
  const session = ctx.session!;
  const r = getRestaurant();
  const boot: AdminBoot = {
    user: session.user,
    csrf: session.csrf,
    restaurantName: r.name,
    logo: r.logo,
    menuUrl: menuUrlFor(ctx).menuUrl,
  };
  return html(
    renderDocument({
      title: `Yönetim Paneli | ${r.name}`,
      head: `<meta name="robots" content="noindex, nofollow"><link rel="icon" type="image/png" href="/simge/64.png">`,
      bodyAttrs: { "data-surface": "admin" },
      body: SKELETON,
      data: { "yonetim-veri": boot },
      entry: "admin",
      themeColor: "#1e1f23",
      rootId: "admin",
    }),
    200,
    { "cache-control": "no-store" },
  );
}

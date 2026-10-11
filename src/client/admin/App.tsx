import { createContext, useContext, useState } from "react";
import { LuMapPinOff } from "react-icons/lu";
import type { AdminBoot } from "../../shared/types";
import { Layout } from "./Layout";
import { matchPath, RouterProvider, useRouter } from "./lib/router";
import { Categories } from "./pages/Categories";
import { DesignPage } from "./pages/Design";
import { MenuBoard } from "./pages/MenuBoard";
import { Overview } from "./pages/Overview";
import { ProductForm } from "./pages/ProductForm";
import { Products } from "./pages/Products";
import { QrPage } from "./pages/Qr";
import { RestaurantPage } from "./pages/Restaurant";
import { SettingsPage } from "./pages/Settings";
import { FeedbackProvider } from "./ui/feedback";
import { ButtonLink, EmptyState } from "./ui/primitives";

interface BootValue extends AdminBoot {
  update: (patch: Partial<AdminBoot>) => void;
}
const BootCtx = createContext<BootValue | null>(null);

export function useBoot(): BootValue {
  const ctx = useContext(BootCtx);
  if (!ctx) throw new Error("BootCtx eksik");
  return ctx;
}

function Routes() {
  const { path } = useRouter();
  if (path === "/yonetim") return <Overview />;
  if (path === "/yonetim/menu") return <MenuBoard />;
  if (path === "/yonetim/kategoriler") return <Categories />;
  if (path === "/yonetim/urunler") return <Products />;
  if (path === "/yonetim/urunler/yeni") return <ProductForm key="yeni" id={null} />;
  const edit = matchPath("/yonetim/urunler/:id", path);
  if (edit && /^\d+$/.test(edit.id)) return <ProductForm key={edit.id} id={Number(edit.id)} />;
  if (path === "/yonetim/qr-kod") return <QrPage />;
  if (path === "/yonetim/restoran") return <RestaurantPage />;
  if (path === "/yonetim/tasarim") return <DesignPage />;
  if (path === "/yonetim/ayarlar") return <SettingsPage />;
  return (
    <EmptyState
      icon={LuMapPinOff}
      title="Sayfa bulunamadı"
      text="Aradığınız sayfa taşınmış ya da kaldırılmış olabilir."
      action={<ButtonLink to="/yonetim" variant="primary">Genel Bakış'a dön</ButtonLink>}
    />
  );
}

export function App({ initial }: { initial: AdminBoot }) {
  const [boot, setBoot] = useState(initial);
  const value: BootValue = { ...boot, update: (patch) => setBoot((b) => ({ ...b, ...patch })) };
  return (
    <BootCtx.Provider value={value}>
      <RouterProvider>
        <FeedbackProvider>
          <Layout boot={boot}>
            <Routes />
          </Layout>
        </FeedbackProvider>
      </RouterProvider>
    </BootCtx.Provider>
  );
}

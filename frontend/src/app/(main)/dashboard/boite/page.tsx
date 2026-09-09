import { getValueFromCookie } from "@/server/server-actions";

import { BoiteComponent } from "./_components/boite";
import { BOITE_LAYOUT_COOKIE, DEFAULT_BOITE_LAYOUT } from "./_components/boite-config";

export default async function BoitePage() {
  const layoutCookie = await getValueFromCookie(BOITE_LAYOUT_COOKIE);

  return (
    <div
      data-content-padding="false"
      className="h-[calc(100dvh-var(--dashboard-header-height,3rem))] min-h-0 overflow-hidden"
    >
      <BoiteComponent defaultLayout={layoutCookie ? JSON.parse(layoutCookie) : [...DEFAULT_BOITE_LAYOUT]} />
    </div>
  );
}

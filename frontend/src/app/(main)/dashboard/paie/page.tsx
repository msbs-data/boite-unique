import * as React from "react";

import { PaieClient } from "./_components/paie-client";

export default function PaiePage() {
  return (
    <React.Suspense
      fallback={<div className="text-muted-foreground p-8 text-center text-sm">Chargement de la collecte...</div>}
    >
      <PaieClient />
    </React.Suspense>
  );
}

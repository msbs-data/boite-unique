import * as React from "react";

import { FacturationClient } from "./_components/facturation-client";

export default function FacturationPage() {
  return (
    <React.Suspense
      fallback={<div className="text-muted-foreground p-8 text-center text-sm">Chargement de la facturation...</div>}
    >
      <FacturationClient />
    </React.Suspense>
  );
}

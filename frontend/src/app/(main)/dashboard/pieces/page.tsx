import * as React from "react";

import { PiecesTableClient } from "./_components/pieces-table-client";

export default function PiecesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">Chargement du tableau des pièces...</div>
      }
    >
      <PiecesTableClient />
    </React.Suspense>
  );
}

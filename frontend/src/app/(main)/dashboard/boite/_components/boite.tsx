"use client";

import * as React from "react";

import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useSidebar } from "@/components/ui/sidebar";
import { api, type Dossier, type Piece } from "@/lib/api-client";
import { setClientCookie } from "@/lib/cookie.client";
import { useCabinetStore } from "@/stores/cabinet-store";

import { BOITE_DETAIL_PANEL_ID, BOITE_LAYOUT_COOKIE, BOITE_LIST_PANEL_ID, DEFAULT_BOITE_LAYOUT } from "./boite-config";
import { BoiteInbox } from "./boite-inbox";
import { BoiteView } from "./boite-view";
import { useBoiteStore } from "./use-boite";

interface BoiteProps {
  defaultLayout?: number[] | undefined;
}

export function BoiteComponent({ defaultLayout = [...DEFAULT_BOITE_LAYOUT] }: BoiteProps) {
  const { isMobile } = useSidebar();
  const [isMounted, setIsMounted] = React.useState(false);

  const { lastUpdated, fetchStats } = useCabinetStore();
  const { selectedId, setSelectedId } = useBoiteStore();

  const [pieces, setPieces] = React.useState<Piece[]>([]);
  const [dossiers, setDossiers] = React.useState<Dossier[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [piecesData, dossiersData] = await Promise.all([api.getPieces(), api.getDossiers()]);
      setPieces(piecesData);
      setDossiers(dossiersData);

      if (piecesData.length > 0) {
        // If nothing selected or selected piece no longer exists, select first
        setSelectedId(selectedId ?? piecesData[0].id);
      }
    } catch (err) {
      console.error("Erreur lors du chargement de la boîte:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedId, setSelectedId]);

  React.useEffect(() => {
    if (lastUpdated) {
      void loadData();
    }
  }, [loadData, lastUpdated]);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const handlePieceUpdated = (updatedPiece: Piece) => {
    setPieces((prev) => prev.map((p) => (p.id === updatedPiece.id ? updatedPiece : p)));
    fetchStats();
  };

  const selectedPiece = pieces.find((p) => p.id === selectedId) || (pieces.length > 0 ? pieces[0] : null);

  if (!isMounted) {
    return (
      <div className="flex size-full items-center justify-center text-muted-foreground text-sm">
        Chargement de la boîte de réception...
      </div>
    );
  }

  return isMobile ? (
    <BoiteMobileLayout
      pieces={pieces}
      dossiers={dossiers}
      selectedPiece={selectedPiece}
      onPieceUpdated={handlePieceUpdated}
      onRefresh={loadData}
      loading={loading}
    />
  ) : (
    <BoiteDesktopLayout
      pieces={pieces}
      dossiers={dossiers}
      selectedPiece={selectedPiece}
      onPieceUpdated={handlePieceUpdated}
      onRefresh={loadData}
      loading={loading}
      defaultLayout={defaultLayout}
    />
  );
}

interface LayoutProps {
  pieces: Piece[];
  dossiers: Dossier[];
  selectedPiece: Piece | null;
  onPieceUpdated: (piece: Piece) => void;
  onRefresh: () => void;
  loading: boolean;
}

function BoiteMobileLayout({ pieces, dossiers, selectedPiece, onPieceUpdated, onRefresh, loading }: LayoutProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <BoiteInbox
        pieces={pieces}
        dossiers={dossiers}
        onSelectPiece={() => setIsOpen(true)}
        onRefresh={onRefresh}
        loading={loading}
      />

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="h-[92vh] p-0">
          <DrawerTitle className="sr-only">Facture</DrawerTitle>
          <DrawerDescription className="sr-only">Détails de la pièce comptable</DrawerDescription>
          <BoiteView piece={selectedPiece} onClose={() => setIsOpen(false)} onPieceUpdated={onPieceUpdated} />
        </DrawerContent>
      </Drawer>
    </>
  );
}

function BoiteDesktopLayout({
  pieces,
  dossiers,
  selectedPiece,
  onPieceUpdated,
  onRefresh,
  loading,
  defaultLayout = [...DEFAULT_BOITE_LAYOUT],
}: LayoutProps & { defaultLayout?: number[] }) {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      onLayoutChanged={(layout) => {
        const sizes = [layout[BOITE_LIST_PANEL_ID], layout[BOITE_DETAIL_PANEL_ID]];
        setClientCookie(BOITE_LAYOUT_COOKIE, JSON.stringify(sizes));
      }}
      className="h-full"
    >
      <ResizablePanel id={BOITE_LIST_PANEL_ID} defaultSize={`${defaultLayout[0]}%`} minSize="28%" className="min-h-0">
        <BoiteInbox pieces={pieces} dossiers={dossiers} onRefresh={onRefresh} loading={loading} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel id={BOITE_DETAIL_PANEL_ID} defaultSize={`${defaultLayout[1]}%`} minSize="40%" className="min-h-0">
        <BoiteView piece={selectedPiece} onPieceUpdated={onPieceUpdated} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

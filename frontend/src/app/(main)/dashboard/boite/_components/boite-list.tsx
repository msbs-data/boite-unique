"use client";

import { cn } from "cn";
import { Camera, CheckCircle2, Clock, FileText, Send, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Piece } from "@/lib/api-client";

import { useBoiteStore } from "./use-boite";

interface BoiteListProps {
  pieces: Piece[];
  onSelectPiece?: (piece: Piece) => void;
}

export function BoiteList({ pieces, onSelectPiece }: BoiteListProps) {
  const { selectedId, setSelectedId, searchTerm, filterDossier, filterEtat } = useBoiteStore();

  const filteredPieces = pieces.filter((p) => {
    if (filterDossier !== "all" && p.dossier_code !== filterDossier) {
      return false;
    }
    if (filterEtat !== "all" && p.etat !== filterEtat) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchesName = p.nom_fichier?.toLowerCase().includes(q);
      const matchesFournisseur = p.fournisseur?.toLowerCase().includes(q);
      const matchesNumero = p.numero?.toLowerCase().includes(q);
      const matchesDossier = p.dossier_code?.toLowerCase().includes(q);
      const matchesRaison = p.raison_sociale?.toLowerCase().includes(q);
      if (!matchesName && !matchesFournisseur && !matchesNumero && !matchesDossier && !matchesRaison) {
        return false;
      }
    }
    return true;
  });

  const aVerifier = filteredPieces.filter((p) => p.etat === "a_verifier");
  const lues = filteredPieces.filter((p) => p.etat === "lue");
  const exportees = filteredPieces.filter((p) => p.etat === "exportee");

  const groups = [
    { id: "a_verifier", title: "À vérifier (Contrôle requis)", items: aVerifier, icon: Clock, color: "text-amber-600" },
    { id: "lue", title: "Factur-X validées", items: lues, icon: CheckCircle2, color: "text-emerald-600" },
    { id: "exportee", title: "Exportées vers Sage", items: exportees, icon: Send, color: "text-blue-600" },
  ].filter((g) => g.items.length > 0);

  if (filteredPieces.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <FileText className="mb-2 size-10 opacity-30" />
        <p className="font-medium text-sm">Aucune facture</p>
        <p className="mt-1 max-w-xs text-muted-foreground text-xs">
          Aucun document ne correspond à vos critères de recherche ou de filtre.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="**:data-[slot=scroll-area-viewport]:scroll-fade min-h-0 flex-1">
      <div className="flex flex-col gap-3 py-2">
        {groups.map((group) => (
          <section key={group.id} className="flex flex-col gap-1">
            <div className="mx-3 flex items-center gap-1.5 font-semibold text-muted-foreground text-xs">
              <group.icon className={`size-3.5 ${group.color}`} />
              <span>{group.title}</span>
              <span className="font-mono text-[11px]">({group.items.length})</span>
            </div>

            <div className="flex flex-col">
              {group.items.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={cn(
                      "group relative w-full border-transparent border-y p-3.5 text-left transition-colors",
                      "hover:bg-muted/60",
                      isSelected &&
                        "border-border bg-muted/80 before:absolute before:-inset-y-px before:left-0 before:w-1 before:bg-primary",
                    )}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setSelectedId(item.id);
                      onSelectPiece?.(item);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-9 shrink-0 rounded-lg after:rounded-lg">
                        <AvatarFallback className="rounded-lg border bg-background font-mono font-semibold text-xs">
                          {item.dossier_code?.slice(0, 2) || "FC"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="truncate font-semibold text-foreground text-sm leading-tight">
                            {item.fournisseur || item.nom_fichier}
                          </div>
                          <div className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {item.recue_le?.slice(0, 10)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
                          <div className="truncate">
                            <span className="font-medium font-mono text-foreground">{item.dossier_code}</span>
                            <span className="mx-1">&bull;</span>
                            <span>{item.nom_fichier}</span>
                          </div>
                          <div className="shrink-0 font-bold text-foreground tabular-nums">
                            {item.montant_ttc ? `${item.montant_ttc} €` : "—"}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          {item.type === "structure" ? (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-emerald-500/10 py-0 font-medium text-[10px] text-emerald-700 dark:text-emerald-400"
                            >
                              <Sparkles className="size-2.5" /> Factur-X
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-blue-500/10 py-0 font-medium text-[10px] text-blue-700 dark:text-blue-400"
                            >
                              <Camera className="size-2.5" /> Photo / OCR
                            </Badge>
                          )}
                          {item.numero && (
                            <span className="font-mono text-[10px] text-muted-foreground">N° {item.numero}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}

"use client";

import { cn } from "cn";
import { Inbox, RefreshCw, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Dossier, Piece } from "@/lib/api-client";

import { BoiteList } from "./boite-list";
import { useBoiteStore } from "./use-boite";

interface BoiteInboxProps {
  pieces: Piece[];
  dossiers: Dossier[];
  onSelectPiece?: (piece: Piece) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function BoiteInbox({ pieces, dossiers, onSelectPiece, onRefresh, loading = false }: BoiteInboxProps) {
  const { searchTerm, setSearchTerm, filterDossier, setFilterDossier, filterEtat, setFilterEtat } = useBoiteStore();

  const countAVerifier = pieces.filter((p) => p.etat === "a_verifier").length;
  const countLues = pieces.filter((p) => p.etat === "lue").length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* En-tête synchronisé avec le volet de détail */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2.5">
          <Inbox className="size-4 text-primary" />
          <h1 className="font-semibold text-base leading-none">Boîte de réception</h1>
          <Badge variant="secondary" className="font-mono text-xs">
            {pieces.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button variant="ghost" size="icon-sm" onClick={onRefresh} disabled={loading} title="Rafraîchir la boîte">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="space-y-2.5 border-b p-3">
        <InputGroup className="h-8 w-full rounded-lg">
          <InputGroupAddon align="inline-start">
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            className="h-8 text-xs"
            placeholder="Rechercher fournisseur, n°, fichier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <InputGroupAddon align="inline-end">
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </InputGroupAddon>
          )}
        </InputGroup>

        {/* Filtres Dossiers & État */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={filterDossier} onValueChange={setFilterDossier}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Dossiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous dossiers ({dossiers.length})</SelectItem>
              {dossiers.map((d) => (
                <SelectItem key={d.code} value={d.code} className="font-mono text-xs">
                  {d.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterEtat} onValueChange={setFilterEtat}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="État" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous ({pieces.length})</SelectItem>
              <SelectItem value="a_verifier">À vérifier ({countAVerifier})</SelectItem>
              <SelectItem value="lue">Validées ({countLues})</SelectItem>
              <SelectItem value="exportee">Exportées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Liste scrollable */}
      <div className="flex min-h-0 flex-1 flex-col">
        <BoiteList pieces={pieces} onSelectPiece={onSelectPiece} />
      </div>
    </div>
  );
}

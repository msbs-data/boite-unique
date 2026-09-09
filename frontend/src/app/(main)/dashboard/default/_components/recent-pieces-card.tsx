"use client";

import * as React from "react";

import Link from "next/link";

import { ArrowRight, CheckCircle2, Clock, ExternalLink, FileText, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Piece } from "@/lib/api-client";
import { useCabinetStore } from "@/stores/cabinet-store";

export function RecentPiecesCard() {
  const { lastUpdated } = useCabinetStore();
  const [pieces, setPieces] = React.useState<Piece[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (lastUpdated !== undefined) {
      setLoading(true);
      api
        .getPieces()
        .then((data) => {
          setPieces(data.slice(0, 10));
          setLoading(false);
        })
        .catch((err) => {
          console.error("Erreur chargement des pièces:", err);
          setLoading(false);
        });
    }
  }, [lastUpdated]);

  const renderBadgeEtat = (etat: string) => {
    switch (etat) {
      case "lue":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="size-3" /> Factur-X validée
          </Badge>
        );
      case "a_verifier":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <Clock className="size-3" /> À vérifier
          </Badge>
        );
      case "exportee":
        return (
          <Badge variant="outline" className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            Exportée Sage
          </Badge>
        );
      default:
        return <Badge variant="secondary">{etat}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">Dernières pièces traitées</CardTitle>
        <CardDescription>Flux entrants en temps réel, affectation aux dossiers et extraction fiscale</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/pieces" className="gap-1">
              Voir tout le tableau
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Chargement des pièces...</div>
        ) : pieces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <FileText className="size-5" />
            </div>
            <p className="text-sm font-medium">Aucune pièce traitée pour l'instant</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Cliquez sur "Recevoir le prochain mail" ou "Tout relever" en haut pour simuler l'arrivée des factures.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">N°</TableHead>
                  <TableHead>Dossier</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Fichier / Réf</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[70px] text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pieces.map((piece) => (
                  <TableRow key={piece.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">#{piece.id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {piece.dossier_code}
                      </Badge>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                        {piece.raison_sociale}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {piece.fournisseur || <span className="italic text-muted-foreground text-xs">À renseigner</span>}
                      {piece.siren && (
                        <div className="text-[10px] text-muted-foreground font-mono">SIREN: {piece.siren}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs truncate max-w-[180px]">{piece.nom_fichier}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {piece.numero ? `Facture N° ${piece.numero}` : piece.recue_le?.slice(0, 10)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-sm">
                      {piece.montant_ttc ? (
                        `${piece.montant_ttc} €`
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                      {piece.montant_ht && (
                        <div className="text-[10px] text-muted-foreground">HT: {piece.montant_ht} €</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {piece.type === "structure" ? (
                        <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 text-[10px]">
                          <Sparkles className="size-2.5" /> Factur-X
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          OCR / Image
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{renderBadgeEtat(piece.etat)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" asChild>
                        <Link href={`/dashboard/boite?id=${piece.id}`} title="Ouvrir dans la boîte">
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

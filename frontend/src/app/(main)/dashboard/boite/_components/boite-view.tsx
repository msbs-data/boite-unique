"use client";

import * as React from "react";

import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type Piece } from "@/lib/api-client";

import { useBoiteStore } from "./use-boite";

interface BoiteViewProps {
  piece: Piece | null;
  onClose?: () => void;
  onPieceUpdated?: (updatedPiece: Piece) => void;
}

function getCompteCharge(piece: Piece): { compte: string; libelle: string } {
  const f = `${piece.fournisseur ?? ""} ${piece.nom_fichier}`.toLowerCase();
  if (f.includes("bistrot") || f.includes("brasserie") || f.includes("restaurant") || f.includes("repas")) {
    return { compte: "625700", libelle: "Frais de réception & repas client" };
  }
  if (f.includes("total") || f.includes("gazole") || f.includes("carburant") || f.includes("essence")) {
    return { compte: "606100", libelle: "Carburants & déplacements chantier" };
  }
  if (f.includes("point") || f.includes("matériaux") || f.includes("toiture")) {
    return { compte: "601000", libelle: "Achats matières premières & couverture" };
  }
  return { compte: "607000", libelle: piece.fournisseur ?? "Achats de marchandises" };
}

function ConformiteBanner({ piece }: { piece: Piece }) {
  if (piece.type === "structure") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-200">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-sm">Flux certifié Factur-X (XML norme EN 16931)</div>
          <div className="text-emerald-850 leading-relaxed dark:text-emerald-300/90">
            Métadonnées fiscales intégrées et certifiées. Lignes d'écritures générées automatiquement pour Sage sans
            risque d'erreur de saisie.
          </div>
        </div>
      </div>
    );
  }

  if (piece.type === "image") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-950 dark:text-blue-200">
        <Camera className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="space-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">Reconnaissance OCR & Vision IA appliquée</span>
            {piece.confiance && (
              <Badge
                variant="outline"
                className="border-blue-500/40 bg-blue-500/10 font-mono text-[11px] text-blue-700 dark:text-blue-300"
              >
                Confiance OCR {Math.round(piece.confiance * 100)}%
              </Badge>
            )}
          </div>
          <div className="text-blue-850 leading-relaxed dark:text-blue-300/90">
            Photo smartphone / ticket de caisse numérisé. Les montants HT, TVA et TTC ont été reconnus par OCR. Vérifiez
            la conformité avec l'aperçu du document avant validation.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-1 text-xs">
        <div className="font-semibold text-sm">Pièce non structurée / Document à contrôler</div>
        <div className="text-amber-850 leading-relaxed dark:text-amber-300/90">
          Ce document ne dispose pas de flux Factur-X certifié. Contrôlez les montants et le fournisseur avant de
          valider l'export.
        </div>
      </div>
    </div>
  );
}

export function BoiteView({ piece, onClose, onPieceUpdated }: BoiteViewProps) {
  const { setSelectedId } = useBoiteStore();
  const [isValidating, setIsValidating] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [prevId, setPrevId] = React.useState(piece?.id);

  if (piece?.id !== prevId) {
    setPrevId(piece?.id);
    setImageError(false);
  }

  function handleClose() {
    setSelectedId(null);
    onClose?.();
  }

  const handleValider = async () => {
    if (!piece) return;
    try {
      setIsValidating(true);
      const res = await api.validerPiece(piece.id);
      toast.success(res.message || "Pièce validée avec succès.");
      onPieceUpdated?.({ ...piece, etat: "lue", validee_par: "Utilisateur" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la validation.";
      toast.error(message);
    } finally {
      setIsValidating(false);
    }
  };

  if (!piece) {
    return (
      <div className="grid h-full place-items-center bg-background p-8 text-center text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60">
            <FileText className="size-7 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-base text-foreground">Aucune facture sélectionnée</p>
            <p className="max-w-xs text-muted-foreground text-xs leading-relaxed">
              Sélectionnez une facture dans la liste de gauche pour consulter les données Factur-X extraites ou
              visualiser le document source.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fileUrl = api.getPieceFileUrl(piece.id);
  const isPdf = piece.nom_fichier.toLowerCase().endsWith(".pdf");
  const isImage = /\.(jpe?g|png|webp|gif|heic|tiff?)$/i.test(piece.nom_fichier);
  const compteCharge = getCompteCharge(piece);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Barre d'outils supérieure synchronisée en hauteur (h-14) avec le panneau gauche */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          {onClose && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                    <X className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fermer la pièce</TooltipContent>
              </Tooltip>
              <Separator className="h-4 data-vertical:self-center" orientation="vertical" />
            </>
          )}

          <Badge variant="outline" className="font-mono text-xs">
            {piece.dossier_code}
          </Badge>
          <span className="font-mono text-muted-foreground text-xs">Pièce #{piece.id}</span>

          {piece.etat === "a_verifier" && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-700 text-xs dark:text-amber-400"
            >
              À vérifier
            </Badge>
          )}
          {piece.etat === "lue" && (
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-xs dark:text-emerald-400"
            >
              Validée
            </Badge>
          )}
          {piece.etat === "exportee" && (
            <Badge
              variant="outline"
              className="border-blue-500/40 bg-blue-500/10 text-blue-700 text-xs dark:text-blue-400"
            >
              Exportée Sage
            </Badge>
          )}
        </div>

        {/* Actions principales avec padding confortable à droite */}
        <div className="flex items-center gap-2">
          {piece.etat === "a_verifier" && (
            <Button
              size="sm"
              onClick={handleValider}
              disabled={isValidating}
              className="gap-1.5 bg-emerald-600 font-medium text-white text-xs shadow-xs hover:bg-emerald-700"
            >
              {isValidating ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Valider la facture
            </Button>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs shadow-xs">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="size-3.5" />
                  <span>Télécharger</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Télécharger le fichier source</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ouvrir en plein écran</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* En-tête de la facture avec métadonnées client et montant net */}
      <div className="shrink-0 space-y-3 border-b bg-muted/10 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-bold text-foreground text-xl tracking-tight">
              {piece.fournisseur ?? piece.nom_fichier}
            </h2>
          </div>
          <div className="shrink-0 font-extrabold text-2xl text-foreground tabular-nums">
            {piece.montant_ttc
              ? `${Number(piece.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
              : "—"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Avatar className="size-9 rounded-lg after:rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary/10 font-bold font-mono text-primary text-xs">
              {piece.dossier_code?.slice(0, 2) ?? "FC"}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col gap-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{piece.raison_sociale}</span>
              <Separator orientation="vertical" className="h-3" />
              <span className="font-mono text-muted-foreground">{piece.nom_fichier}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>Reçu le {piece.recue_le.replace("T", " à ").slice(0, 19)}</span>
              {piece.expediteur && (
                <>
                  <Separator orientation="vertical" className="h-3" />
                  <span>De : {piece.expediteur}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Onglets : Données Factur-X & Contrôle / Aperçu Document */}
      <Tabs defaultValue="metadonnees" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b bg-background px-4 sm:px-6">
          <TabsList className="h-11 w-full justify-start gap-6 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="metadonnees"
              className="relative h-11 rounded-none border-b-2 border-b-transparent bg-transparent px-1 pt-2 pb-3 font-medium text-muted-foreground text-xs shadow-none transition-colors data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Données Factur-X & Contrôle
            </TabsTrigger>
            <TabsTrigger
              value="apercu"
              className="relative h-11 rounded-none border-b-2 border-b-transparent bg-transparent px-1 pt-2 pb-3 font-medium text-muted-foreground text-xs shadow-none transition-colors data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Aperçu du document
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ONGLET 1 : MÉTADONNÉES AVEC CARDS SHADCN POLIES */}
        <TabsContent value="metadonnees" className="m-0 min-h-0 flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
              {/* Bannière de conformité */}
              <ConformiteBanner piece={piece} />

              {/* Cartes Fournisseur et Référence Facture côte à côte */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Carte Fournisseur */}
                <Card className="shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 font-semibold text-sm">
                      <Tag className="size-4 text-primary" />
                      Fournisseur
                    </CardTitle>
                    <CardDescription>Identification fiscale du tiers</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Raison sociale</div>
                      <div className="mt-0.5 font-semibold text-foreground text-sm">
                        {piece.fournisseur ?? "Non renseigné"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t pt-2">
                      <div>
                        <div className="text-muted-foreground text-xs">SIREN</div>
                        <div className="mt-0.5 font-medium font-mono text-foreground text-xs">{piece.siren ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">N° TVA Intracom</div>
                        <div className="mt-0.5 font-medium font-mono text-foreground text-xs">
                          {piece.tva_intracom ?? "—"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Carte Facture & Dates */}
                <Card className="shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 font-semibold text-sm">
                      <FileCheck2 className="size-4 text-primary" />
                      Référence Facture
                    </CardTitle>
                    <CardDescription>Numérotation et période d'exigibilité</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Numéro de pièce</div>
                      <div className="mt-0.5 font-mono font-semibold text-foreground text-sm">
                        {piece.numero ?? "Non renseigné"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t pt-2">
                      <div>
                        <div className="text-muted-foreground text-xs">Date d'émission</div>
                        <div className="mt-0.5 font-medium text-foreground text-xs">{piece.date_facture ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Devise</div>
                        <div className="mt-0.5 font-medium text-foreground text-xs">{piece.devise ?? "EUR"}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Carte Ventilation Financière Décomptée (Pleine largeur avec 3 grands blocs de métriques) */}
              <Card className="shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="font-semibold text-sm">Ventilation Financière Décomptée</CardTitle>
                  <CardDescription>Bases hors taxes, TVA déductible et montant net à payer</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="font-medium text-muted-foreground text-xs">Total Hors Taxes (HT)</div>
                      <div className="mt-1.5 font-bold text-foreground text-xl tabular-nums">
                        {piece.montant_ht
                          ? `${Number(piece.montant_ht).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
                          : "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="font-medium text-muted-foreground text-xs">TVA Déductible</div>
                      <div className="mt-1.5 font-bold text-primary text-xl tabular-nums">
                        {piece.montant_tva
                          ? `${Number(piece.montant_tva).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
                          : "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <div className="font-semibold text-emerald-800 text-xs dark:text-emerald-300">
                        Total TTC à Payer
                      </div>
                      <div className="mt-1.5 font-extrabold text-emerald-600 text-xl tabular-nums dark:text-emerald-400">
                        {piece.montant_ttc
                          ? `${Number(piece.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Carte Écritures Comptables Journal Sage AC (Pleine largeur avec tableau complet sans troncature) */}
              <Card className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 font-semibold text-sm">
                        <BookOpen className="size-4 text-primary" />
                        Écritures Comptables Journal Sage AC
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Schéma d'écriture à partie double équilibrée pour Sage 100 / Sage 1000
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-3" /> Partie double équilibrée
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[80px] pl-6">Journal</TableHead>
                          <TableHead className="w-[120px]">N° Compte</TableHead>
                          <TableHead className="min-w-[220px]">Libellé de l'écriture</TableHead>
                          <TableHead className="w-[140px] text-right">Débit (€)</TableHead>
                          <TableHead className="w-[140px] pr-6 text-right">Crédit (€)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="pl-6 font-mono font-semibold text-xs">AC</TableCell>
                          <TableCell className="font-mono text-xs">{compteCharge.compte}</TableCell>
                          <TableCell className="font-medium text-foreground text-xs">{compteCharge.libelle}</TableCell>
                          <TableCell className="text-right font-medium font-mono text-emerald-600 text-xs">
                            {piece.montant_ht
                              ? Number(piece.montant_ht).toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                              : "0,00"}
                          </TableCell>
                          <TableCell className="pr-6 text-right font-mono text-muted-foreground text-xs">—</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-6 font-mono font-semibold text-xs">AC</TableCell>
                          <TableCell className="font-mono text-xs">445660</TableCell>
                          <TableCell className="font-medium text-foreground text-xs">
                            TVA déductible sur achats
                          </TableCell>
                          <TableCell className="text-right font-medium font-mono text-emerald-600 text-xs">
                            {piece.montant_tva
                              ? Number(piece.montant_tva).toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                              : "0,00"}
                          </TableCell>
                          <TableCell className="pr-6 text-right font-mono text-muted-foreground text-xs">—</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-6 font-mono font-semibold text-xs">AC</TableCell>
                          <TableCell className="font-mono text-xs">401000</TableCell>
                          <TableCell className="font-medium text-foreground text-xs">
                            Fournisseur {piece.fournisseur ?? "Tiers"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground text-xs">—</TableCell>
                          <TableCell className="pr-6 text-right font-medium font-mono text-blue-600 text-xs">
                            {piece.montant_ttc
                              ? Number(piece.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                              : "0,00"}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Carte Traçabilité Technique */}
              <Card className="shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="font-semibold text-sm">Traçabilité & Empreinte Numérique</CardTitle>
                  <CardDescription>Contrôle d'intégrité SHA-256 et profil d'extraction Factur-X</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <div className="text-muted-foreground">Profil d'extraction</div>
                      <div className="mt-0.5 font-medium text-foreground">{piece.profil ?? "EN 16931"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Méthode</div>
                      <div className="mt-0.5 font-medium text-foreground">{piece.methode ?? "Factur-X"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Empreinte SHA-256</div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-foreground" title={piece.empreinte}>
                        {piece.empreinte}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ONGLET 2 : APERÇU DU DOCUMENT */}
        <TabsContent value="apercu" className="m-0 min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
          <div className="flex size-full flex-col overflow-hidden rounded-xl border bg-muted/10 shadow-xs">
            <div className="flex h-10 shrink-0 items-center justify-between border-b bg-card px-4 text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="truncate font-medium font-mono">{piece.nom_fichier}</span>
                {isImage && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-400"
                  >
                    <Camera className="size-2.5" /> Photo Smartphone
                  </Badge>
                )}
              </div>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                Plein écran
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
              {isImage ? (
                <div className="flex size-full items-center justify-center overflow-auto bg-muted/20 p-4">
                  {imageError ? (
                    <div className="flex flex-col items-center gap-3 p-6 text-center text-muted-foreground">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                        <AlertTriangle className="size-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground text-sm">Aperçu temporairement indisponible</p>
                        <p className="max-w-xs text-xs">
                          Le document source ne peut être affiché directement. Vous pouvez l'ouvrir dans un nouvel
                          onglet.
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" /> Ouvrir en plein écran
                        </a>
                      </Button>
                    </div>
                  ) : (
                    /* biome-ignore lint/performance/noImgElement: user dynamic invoice attachment */
                    <img
                      key={piece.id}
                      src={fileUrl}
                      alt={piece.nom_fichier}
                      onError={() => setImageError(true)}
                      className="max-h-[75vh] w-auto max-w-full rounded-lg border object-contain shadow-md"
                    />
                  )}
                </div>
              ) : (
                <iframe
                  src={isPdf ? `${fileUrl}#toolbar=1` : fileUrl}
                  title={`Aperçu ${piece.nom_fichier}`}
                  className="size-full rounded-lg border-0"
                />
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

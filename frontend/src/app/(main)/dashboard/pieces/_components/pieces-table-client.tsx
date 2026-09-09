"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Dossier, type Piece } from "@/lib/api-client";
import { useCabinetStore } from "@/stores/cabinet-store";

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

export function PiecesTableClient() {
  const searchParams = useSearchParams();
  const dossierParam = searchParams.get("dossier");

  const { lastUpdated, fetchStats, recevoirEmails, isReceiving } = useCabinetStore();

  const [pieces, setPieces] = React.useState<Piece[]>([]);
  const [dossiers, setDossiers] = React.useState<Dossier[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedDossier, setSelectedDossier] = React.useState<string>(dossierParam || "all");
  const [selectedEtat, setSelectedEtat] = React.useState<string>("all");

  const [activePiece, setActivePiece] = React.useState<Piece | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [previewImageError, setPreviewImageError] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [pData, dData] = await Promise.all([api.getPieces(), api.getDossiers()]);
      setPieces(pData);
      setDossiers(dData);
    } catch (err) {
      console.error("Erreur chargement des données:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (lastUpdated !== undefined) {
      void loadData();
    }
  }, [loadData, lastUpdated]);

  React.useEffect(() => {
    if (dossierParam) {
      setSelectedDossier(dossierParam);
    }
  }, [dossierParam]);

  const handleValider = async (id: number) => {
    try {
      setIsValidating(true);
      const res = await api.validerPiece(id);
      toast.success(res.message || "Pièce validée avec succès.");
      setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, etat: "lue", validee_par: "Utilisateur" } : p)));
      if (activePiece && activePiece.id === id) {
        setActivePiece({ ...activePiece, etat: "lue", validee_par: "Utilisateur" });
      }
      fetchStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la validation.";
      toast.error(msg);
    } finally {
      setIsValidating(false);
    }
  };

  const filteredPieces = React.useMemo(() => {
    return pieces.filter((p) => {
      if (selectedDossier !== "all" && p.dossier_code !== selectedDossier) {
        return false;
      }
      if (selectedEtat !== "all" && p.etat !== selectedEtat) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = p.nom_fichier?.toLowerCase().includes(q);
        const matchesFournisseur = p.fournisseur?.toLowerCase().includes(q);
        const matchesNumero = p.numero?.toLowerCase().includes(q);
        const matchesDossier = p.dossier_code?.toLowerCase().includes(q);
        const matchesRaison = p.raison_sociale?.toLowerCase().includes(q);
        const matchesSiren = p.siren?.toLowerCase().includes(q);
        if (
          !matchesName &&
          !matchesFournisseur &&
          !matchesNumero &&
          !matchesDossier &&
          !matchesRaison &&
          !matchesSiren
        ) {
          return false;
        }
      }
      return true;
    });
  }, [pieces, selectedDossier, selectedEtat, searchTerm]);

  // Financial summary
  const totalTtc = filteredPieces.reduce((acc, p) => {
    const val = parseFloat(p.montant_ttc || "0");
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const totalHt = filteredPieces.reduce((acc, p) => {
    const val = parseFloat(p.montant_ht || "0");
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

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

  const openPieceDetails = (piece: Piece) => {
    setActivePiece(piece);
    setPreviewImageError(false);
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header avec métriques et actions */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg tracking-tight">Tableau des pièces comptables</h1>
            <Badge variant="outline" className="font-mono text-xs">
              {filteredPieces.length} ligne{filteredPieces.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Vue tabulaire haute densité : consultation des pièces, vérification et métadonnées fiscales
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 border-r pr-3 text-xs">
            <div>
              <span className="text-muted-foreground">Total HT : </span>
              <span className="font-semibold tabular-nums">{totalHt.toFixed(2)} €</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total TTC : </span>
              <span className="font-bold text-primary tabular-nums">{totalTtc.toFixed(2)} €</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => recevoirEmails(false)}
            disabled={isReceiving}
            className="gap-1.5"
          >
            {isReceiving ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
            Recevoir 1 mail
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={loadData} title="Rafraîchir" disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher fournisseur, n°, dossier, SIREN..."
                className="pl-8 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtres Dossier & État */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedDossier} onValueChange={setSelectedDossier}>
                <SelectTrigger className="h-9 w-[190px] text-xs">
                  <SelectValue placeholder="Dossier client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les dossiers</SelectItem>
                  {dossiers.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.code} — {d.raison_sociale.slice(0, 18)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Tabs value={selectedEtat} onValueChange={setSelectedEtat} className="w-auto">
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs">
                    Toutes
                  </TabsTrigger>
                  <TabsTrigger value="a_verifier" className="text-xs">
                    À vérifier
                  </TabsTrigger>
                  <TabsTrigger value="lue" className="text-xs">
                    Factur-X
                  </TabsTrigger>
                  <TabsTrigger value="exportee" className="text-xs">
                    Exportées
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau principal */}
      <Card>
        <CardContent className="p-0">
          {loading && <div className="py-16 text-center text-sm text-muted-foreground">Chargement des pièces...</div>}
          {!loading && filteredPieces.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="size-10 text-muted-foreground opacity-40 mb-3" />
              <p className="text-sm font-medium">Aucune pièce ne correspond aux filtres</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajustez vos filtres ou relevez des courriels d'achats.
              </p>
            </div>
          )}
          {!loading && filteredPieces.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">N°</TableHead>
                    <TableHead>Dossier</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Fichier / Réf</TableHead>
                    <TableHead>Date Facture</TableHead>
                    <TableHead className="text-right">Montant HT</TableHead>
                    <TableHead className="text-right">Montant TTC</TableHead>
                    <TableHead>Technologie</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right w-[110px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPieces.map((piece) => (
                    <TableRow
                      key={piece.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openPieceDetails(piece)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">#{piece.id}</TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {piece.dossier_code}
                        </Badge>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                          {piece.raison_sociale}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-xs">
                          {piece.fournisseur || <span className="italic text-muted-foreground">Non extrait</span>}
                        </div>
                        {piece.siren && (
                          <div className="text-[10px] text-muted-foreground font-mono">SIREN: {piece.siren}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="font-mono text-xs truncate max-w-[160px]" title={piece.nom_fichier}>
                          {piece.nom_fichier}
                        </div>
                        {piece.numero && <div className="text-[10px] text-muted-foreground">N° {piece.numero}</div>}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {piece.date_facture || piece.recue_le?.slice(0, 10)}
                      </TableCell>

                      <TableCell className="text-right font-medium text-xs tabular-nums text-muted-foreground">
                        {piece.montant_ht ? `${piece.montant_ht} €` : "—"}
                      </TableCell>

                      <TableCell className="text-right font-bold text-xs tabular-nums">
                        {piece.montant_ttc ? `${piece.montant_ttc} €` : "—"}
                      </TableCell>

                      <TableCell>
                        {piece.type === "structure" ? (
                          <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 text-[10px]">
                            <Sparkles className="size-2.5" /> Factur-X
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px]"
                          >
                            <Camera className="size-2.5" /> Photo / OCR
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>{renderBadgeEtat(piece.etat)}</TableCell>

                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {piece.etat === "a_verifier" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title="Valider directement la pièce"
                              onClick={() => handleValider(piece.id)}
                              disabled={isValidating}
                            >
                              <CheckCircle2 className="size-3" />
                              Valider
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 gap-1 px-2.5 text-xs font-medium"
                            title="Consulter les détails dans un dialogue"
                            onClick={() => openPieceDetails(piece)}
                          >
                            <Eye className="size-3.5" />
                            Voir
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="size-7" asChild title="Télécharger">
                            <a href={api.getPieceFileUrl(piece.id)} target="_blank" rel="noreferrer">
                              <Download className="size-3.5" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG MODAL DE DÉTAIL & VALIDATION */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border">
          {activePiece && (
            <>
              {/* Header */}
              <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 shrink-0 pr-12 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">Pièce #{activePiece.id}</span>
                  <Badge variant="secondary" className="font-mono text-xs font-semibold">
                    {activePiece.dossier_code}
                  </Badge>
                  {renderBadgeEtat(activePiece.etat)}
                  {activePiece.type === "structure" ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs"
                    >
                      <Sparkles className="size-3" /> Factur-X certifié
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs"
                    >
                      <Camera className="size-3" /> Photo Smartphone / OCR
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-base sm:text-lg font-semibold truncate mt-1">
                  {activePiece.fournisseur || activePiece.nom_fichier}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                  <span>Reçu le {activePiece.recue_le?.replace("T", " à ").slice(0, 19)}</span>
                  <span>&bull;</span>
                  <span>{activePiece.raison_sociale}</span>
                  {activePiece.numero && (
                    <>
                      <span>&bull;</span>
                      <span className="font-mono">Facture N° {activePiece.numero}</span>
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>

              {/* Body: Split Screen (2 colonnes équilibrées) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                {/* Colonne Gauche : Données comptables & Sage */}
                <div className="flex flex-col gap-4">
                  {/* Bannière de conformité */}
                  {activePiece.type === "structure" ? (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-950 dark:text-emerald-200">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <div className="font-semibold text-xs">
                          Factur-X certifié (Profil {activePiece.profil || "EN 16931"})
                        </div>
                        <div className="text-emerald-850 dark:text-emerald-300/90 text-[11px] mt-0.5 leading-relaxed">
                          Format mixte PDF + XML normalisé. Les données fiscales et montants sont certifiés conformes
                          sans saisie manuelle.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-950 dark:text-blue-200">
                      <Camera className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs">Photo Smartphone & Reconnaissance Vision OCR</span>
                          {activePiece.confiance && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            >
                              Confiance OCR {Math.round(activePiece.confiance * 100)}%
                            </Badge>
                          )}
                        </div>
                        <div className="text-blue-850 dark:text-blue-300/90 text-[11px] mt-0.5 leading-relaxed">
                          Ticket de caisse / document photographié. Les montants ont été extraits par OCR.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fiche Métadonnées */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border p-3 bg-card/60 space-y-1">
                      <div className="text-[11px] text-muted-foreground">Fournisseur / Émetteur</div>
                      <div className="font-semibold text-sm truncate">{activePiece.fournisseur || "Non renseigné"}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        SIREN : {activePiece.siren || "—"}{" "}
                        {activePiece.tva_intracom && `• TVA : ${activePiece.tva_intracom}`}
                      </div>
                    </div>

                    <div className="rounded-xl border p-3 bg-card/60 space-y-1">
                      <div className="text-[11px] text-muted-foreground">Numéro & Date Pièce</div>
                      <div className="font-semibold text-sm font-mono truncate">{activePiece.numero || "—"}</div>
                      <div className="text-xs text-muted-foreground">Date : {activePiece.date_facture || "—"}</div>
                    </div>
                  </div>

                  {/* Bloc Montants */}
                  <div className="rounded-xl border p-3.5 bg-card/60">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                      Décomposition des montants
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="border rounded-lg p-2.5 bg-muted/20">
                        <div className="text-[10px] text-muted-foreground font-medium">Montant HT</div>
                        <div className="font-semibold text-sm tabular-nums mt-0.5">
                          {activePiece.montant_ht
                            ? `${Number(activePiece.montant_ht).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
                            : "—"}
                        </div>
                      </div>
                      <div className="border rounded-lg p-2.5 bg-muted/20">
                        <div className="text-[10px] text-muted-foreground font-medium">TVA Déductible</div>
                        <div className="font-semibold text-sm tabular-nums text-primary mt-0.5">
                          {activePiece.montant_tva
                            ? `${Number(activePiece.montant_tva).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
                            : "—"}
                        </div>
                      </div>
                      <div className="border rounded-lg p-2.5 bg-emerald-500/10 border-emerald-500/30">
                        <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium">Total TTC</div>
                        <div className="font-bold text-base tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {activePiece.montant_ttc
                            ? `${Number(activePiece.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proposition d'écriture Sage */}
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="bg-muted/40 px-3.5 py-2 border-b flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">Écriture comptable Sage 100 / 1000</span>
                      <span className="font-mono text-[10px] text-muted-foreground">Journal : AC (Achats)</span>
                    </div>
                    <div className="p-0 overflow-x-auto">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-16">Compte</TableHead>
                            <TableHead>Libellé de l'écriture</TableHead>
                            <TableHead className="w-24 text-right">Débit (€)</TableHead>
                            <TableHead className="w-24 text-right">Crédit (€)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono font-medium">
                              {getCompteCharge(activePiece).compte}
                            </TableCell>
                            <TableCell className="truncate max-w-[180px]">
                              {getCompteCharge(activePiece).libelle}
                            </TableCell>
                            <TableCell className="text-right font-mono text-emerald-600">
                              {activePiece.montant_ht
                                ? Number(activePiece.montant_ht).toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                                : "0,00"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono font-medium">445660</TableCell>
                            <TableCell>TVA déductible sur achats</TableCell>
                            <TableCell className="text-right font-mono text-emerald-600">
                              {activePiece.montant_tva
                                ? Number(activePiece.montant_tva).toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                                : "0,00"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono font-medium">401000</TableCell>
                            <TableCell className="truncate max-w-[180px]">
                              Fournisseur {activePiece.fournisseur ?? "Tiers"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-blue-600">
                              {activePiece.montant_ttc
                                ? Number(activePiece.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                                : "0,00"}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Traçabilité & Empreinte */}
                  <div className="rounded-xl border p-3 bg-muted/10 text-xs space-y-1">
                    <div className="flex flex-wrap justify-between items-center gap-2 text-muted-foreground">
                      <span>
                        Source : <strong className="text-foreground font-medium">{activePiece.source}</strong>
                      </span>
                      <span>
                        Méthode :{" "}
                        <strong className="text-foreground font-medium">
                          {activePiece.methode || "Factur-X / OCR"}
                        </strong>
                      </span>
                    </div>
                    <div className="text-muted-foreground truncate" title={activePiece.empreinte}>
                      Empreinte SHA-256 :{" "}
                      <span className="font-mono text-[10px] text-foreground">{activePiece.empreinte}</span>
                    </div>
                  </div>
                </div>

                {/* Colonne Droite : Visualiseur du document */}
                <div className="flex flex-col rounded-xl border bg-muted/10 overflow-hidden min-h-[440px]">
                  <div className="flex items-center justify-between border-b bg-card px-3.5 py-2 text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono truncate font-medium max-w-[180px]">{activePiece.nom_fichier}</span>
                      {activePiece.type === "image" || /\.(jpg|jpeg|png|webp)$/i.test(activePiece.nom_fichier) ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-400"
                        >
                          <Camera className="size-2.5" /> Photo Smartphone
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
                        >
                          <FileText className="size-2.5" /> PDF Factur-X
                        </Badge>
                      )}
                    </div>
                    <a
                      href={api.getPieceFileUrl(activePiece.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Plein écran
                      <ExternalLink className="size-3" />
                    </a>
                  </div>

                  <div className="flex-1 flex items-center justify-center p-3 bg-muted/20 overflow-auto">
                    {activePiece.type === "image" || /\.(jpg|jpeg|png|webp)$/i.test(activePiece.nom_fichier) ? (
                      previewImageError ? (
                        <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                          <AlertTriangle className="size-8 text-amber-500" />
                          <p className="font-medium text-xs text-foreground">Aperçu direct indisponible</p>
                          <Button variant="outline" size="sm" asChild className="text-xs h-7 gap-1">
                            <a href={api.getPieceFileUrl(activePiece.id)} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-3" /> Ouvrir en plein écran
                            </a>
                          </Button>
                        </div>
                      ) : (
                        /* biome-ignore lint/performance/noImgElement: user dynamic invoice photo preview */
                        <img
                          key={activePiece.id}
                          src={api.getPieceFileUrl(activePiece.id)}
                          alt={activePiece.nom_fichier}
                          onError={() => setPreviewImageError(true)}
                          className="max-h-[520px] w-auto max-w-full rounded-lg border object-contain shadow-md"
                        />
                      )
                    ) : (
                      <iframe
                        src={`${api.getPieceFileUrl(activePiece.id)}#toolbar=1`}
                        title={`Aperçu ${activePiece.nom_fichier}`}
                        className="size-full min-h-[480px] rounded-lg border-0"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <DialogFooter className="p-4 border-t bg-muted/20 shrink-0 flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                    <a href={api.getPieceFileUrl(activePiece.id)} target="_blank" rel="noreferrer">
                      <Download className="size-3.5" />
                      Télécharger
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs">
                    <a href={api.getPieceFileUrl(activePiece.id)} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" />
                      Plein écran
                    </a>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {activePiece.etat === "a_verifier" && (
                    <Button
                      size="sm"
                      onClick={() => handleValider(activePiece.id)}
                      disabled={isValidating}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                    >
                      {isValidating ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      Valider et imputer pour Sage
                    </Button>
                  )}
                  <DialogClose asChild>
                    <Button variant="secondary" size="sm" className="text-xs">
                      Fermer
                    </Button>
                  </DialogClose>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

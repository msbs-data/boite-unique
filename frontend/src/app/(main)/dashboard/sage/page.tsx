"use client";

import * as React from "react";

import {
  AlertCircle,
  ArrowDownToLine,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type ExportHistorique, type SageApercu } from "@/lib/api-client";
import { useCabinetStore } from "@/stores/cabinet-store";

export default function SagePage() {
  const { lastUpdated, fetchStats } = useCabinetStore();
  const [apercu, setApercu] = React.useState<SageApercu | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  const loadApercu = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSageApercu();
      setApercu(data);
    } catch (err) {
      console.error("Erreur chargement aperçu Sage:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (lastUpdated !== undefined) {
      void loadApercu();
    }
  }, [loadApercu, lastUpdated]);

  const handleGenererExport = async () => {
    try {
      setIsExporting(true);
      const exp = await api.genererExportSage();
      toast.success(`Export Sage généré avec succès : ${exp.fichier} (${exp.nb_pieces} pièces)`);
      await loadApercu();
      fetchStats();

      // Trigger direct download of the generated file
      const downloadUrl = api.getExportDownloadUrl(exp.fichier);
      window.open(downloadUrl, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la génération de l'export Sage.");
    } finally {
      setIsExporting(false);
    }
  };

  const nbPieces = apercu?.nb_pieces ?? 0;
  const totalDebit = apercu?.total_debit ?? 0;
  const totalCredit = apercu?.total_credit ?? 0;
  const equilibre = apercu?.equilibre ?? true;
  const lignes = apercu?.lignes ?? [];
  const derniersExports = apercu?.derniers_exports ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête & KPIs */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg tracking-tight">Passerelle Comptable Sage 100 / 1000</h1>
            <Badge variant="outline" className="font-mono text-xs">
              Format CSV (Windows-1252)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Génération des écritures d'achats équilibrées prêtes à l'import dans Sage Comptabilité
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGenererExport}
            disabled={isExporting || nbPieces === 0}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            {isExporting ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
            Générer l'export CSV Sage ({nbPieces})
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={loadApercu} title="Rafraîchir" disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Cartes de synthèse financière */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Factures Prêtes */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pièces Validées</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{nbPieces}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {nbPieces > 0 ? "Factures prêtes à être intégrées au journal" : "Aucune pièce en attente"}
            </p>
          </CardContent>
        </Card>

        {/* 2. Total Débit */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Débit (HT + TVA)</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-foreground">{totalDebit.toFixed(2)} €</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Comptes de charge (471000) et TVA déductible (445660)</p>
          </CardContent>
        </Card>

        {/* 3. Total Crédit */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Crédit (Fournisseurs TTC)</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-foreground">
              {totalCredit.toFixed(2)} €
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Comptes tiers fournisseurs</p>
          </CardContent>
        </Card>

        {/* 4. Équilibre Comptable */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contrôle de Partie Double</CardDescription>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {equilibre ? (
                <>
                  <CheckCircle2 className="size-5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Équilibré</span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-5 text-destructive" />
                  <span className="text-destructive">Écart Débit/Crédit</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Différence : {(totalDebit - totalCredit).toFixed(2)} €</p>
          </CardContent>
        </Card>
      </div>

      {/* Onglets : Écritures / CSV Brut / Historique */}
      <Tabs defaultValue="ecritures" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ecritures" className="gap-1.5 text-xs">
            <FileSpreadsheet className="size-3.5" />
            Écritures comptables ({lignes.length})
          </TabsTrigger>
          <TabsTrigger value="csv" className="gap-1.5 text-xs">
            <FileText className="size-3.5" />
            Aperçu CSV brut
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-1.5 text-xs">
            <History className="size-3.5" />
            Historique des exports ({derniersExports.length})
          </TabsTrigger>
        </TabsList>

        {/* ONGLET 1 : ÉCRITURES SAGE */}
        <TabsContent value="ecritures">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Journal d'achats (Journal AC)</CardTitle>
              <CardDescription>
                Lignes d'écritures générées selon la nomenclature standard Sage 100/1000
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-16 text-center text-sm text-muted-foreground">Chargement des écritures...</div>
              ) : lignes.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Aucune écriture comptable en attente d'export.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Journal</TableHead>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="w-[110px]">Compte</TableHead>
                        <TableHead className="w-[130px]">N° Pièce</TableHead>
                        <TableHead>Libellé de l'écriture</TableHead>
                        <TableHead className="text-right w-[110px]">Débit (€)</TableHead>
                        <TableHead className="text-right w-[110px]">Crédit (€)</TableHead>
                        <TableHead className="w-[150px]">Lien Pièce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.map((l, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs font-semibold">{l.journal}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{l.date_ecriture}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                              {l.compte}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{l.numero_piece}</TableCell>
                          <TableCell className="text-xs font-medium">{l.libelle}</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                            {l.debit !== null && l.debit !== undefined ? l.debit.toFixed(2) : ""}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums font-medium text-blue-600 dark:text-blue-400">
                            {l.credit !== null && l.credit !== undefined ? l.credit.toFixed(2) : ""}
                          </TableCell>
                          <TableCell
                            className="font-mono text-[11px] text-muted-foreground truncate max-w-[150px]"
                            title={l.image}
                          >
                            {l.image}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ONGLET 2 : CSV BRUT */}
        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Format de fichier d'import Sage</CardTitle>
              <CardDescription>
                Séparateur point-virgule (;), format de décimale avec virgule, encodage Windows-1252
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed">
                {apercu?.csv_apercu || "(Aucun export en attente)"}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ONGLET 3 : HISTORIQUE DES EXPORTS */}
        <TabsContent value="historique">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Historique des fichiers générés</CardTitle>
              <CardDescription>
                Téléchargez les fichiers d'écritures générés précédemment pour injection dans Sage
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {derniersExports.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Aucun historique d'export pour le moment.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fichier CSV</TableHead>
                      <TableHead>Date de génération</TableHead>
                      <TableHead className="text-right">Nombre de pièces</TableHead>
                      <TableHead className="text-right w-[120px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {derniersExports.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-mono text-xs font-medium">{exp.fichier}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {exp.fait_le?.replace("T", " à ").slice(0, 19)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs">
                          {exp.nb_pieces} pièce{exp.nb_pieces > 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                            <a href={api.getExportDownloadUrl(exp.fichier)} download>
                              <Download className="size-3.5" />
                              Télécharger
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

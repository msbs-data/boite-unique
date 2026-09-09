"use client";

import Link from "next/link";

import { ArrowRight, CheckCircle2, Cpu, FileCheck2, FolderCheck, Mail, Send } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCabinetStore } from "@/stores/cabinet-store";

export function PipelineStatus() {
  const { stats } = useCabinetStore();

  const total = stats?.pieces ?? 0;
  const lues = stats?.lues ?? 0;
  const aVerifier = stats?.a_verifier ?? 0;
  const exportees = stats?.exportees ?? 0;
  const structurees = stats?.structurees ?? 0;

  const pctFacturx = total > 0 ? Math.round((structurees / total) * 100) : 0;
  const pctExport = total > 0 ? Math.round((exportees / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Colonne 1 : Flux & Qualité d'extraction */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Chaîne d'automatisation comptable</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">EN 16931 / Factur-X</span>
          </div>
          <CardDescription>
            Routage automatique par alias email cabinet et extraction native des métadonnées fiscales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {/* Étape 1 */}
            <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Mail className="size-4 text-primary" />
                Étape 1
              </div>
              <div className="font-semibold text-sm">Routage Email</div>
              <p className="text-xs text-muted-foreground">
                Analyse des en-têtes (X-Original-To, To) vers les {stats?.dossiers ?? 7} dossiers clients.
              </p>
            </div>

            {/* Étape 2 */}
            <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Cpu className="size-4 text-emerald-500" />
                Étape 2
              </div>
              <div className="font-semibold text-sm">Factur-X XML</div>
              <p className="text-xs text-muted-foreground">
                Extraction directe sans OCR : HT, TVA, TTC, SIREN, dates et devises 100% fiables.
              </p>
            </div>

            {/* Étape 3 */}
            <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FolderCheck className="size-4 text-amber-500" />
                Étape 3
              </div>
              <div className="font-semibold text-sm">Contrôle Métier</div>
              <p className="text-xs text-muted-foreground">
                Revue des tickets de caisse ou factures scannées nécessitant validation humaine.
              </p>
            </div>

            {/* Étape 4 */}
            <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Send className="size-4 text-blue-500" />
                Étape 4
              </div>
              <div className="font-semibold text-sm">Intégration Sage</div>
              <p className="text-xs text-muted-foreground">
                Génération des écritures d'achats journal AC équilibrées (débit = crédit) avec lien image.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Taux de dématérialisation native (Factur-X) :</span>
              <span className="font-semibold">
                {pctFacturx}% ({structurees} / {total} pièces)
              </span>
            </div>
            <Progress value={pctFacturx} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Colonne 2 : Synthèse Sage & Accès rapides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Statut Intégration Sage</CardTitle>
          <CardDescription>Écritures prêtes pour l'import Sage 100 / 1000</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pièces validées à exporter</span>
              <span className="text-sm font-semibold text-emerald-600">{lues} pièce(s)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pièces en attente de contrôle</span>
              <span className={`text-sm font-semibold ${aVerifier > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {aVerifier} pièce(s)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Historique exporté</span>
              <span className="text-sm font-semibold text-blue-600">{exportees} pièce(s)</span>
            </div>
          </div>

          <div className="space-y-2">
            <Link
              href="/dashboard/boite"
              className="flex items-center justify-between rounded-md border p-2.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <span>Accéder à la Boîte de réception (Option B)</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/dashboard/pieces"
              className="flex items-center justify-between rounded-md border p-2.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <span>Accéder au Tableau des pièces (Option A)</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>

            <Link
              href="/dashboard/sage"
              className="flex items-center justify-between rounded-md border bg-primary/5 p-2.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <span>Générer l'export Sage 100/1000</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

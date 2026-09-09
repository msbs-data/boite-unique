"use client";

import Link from "next/link";

import { AlertCircle, CheckCircle2, FileCheck2, FileText, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCabinetStore } from "@/stores/cabinet-store";

export function MetricCards() {
  const { stats } = useCabinetStore();

  const totalPieces = stats?.pieces ?? 0;
  const lues = stats?.lues ?? 0;
  const aVerifier = stats?.a_verifier ?? 0;
  const exportees = stats?.exportees ?? 0;
  const structurees = stats?.structurees ?? 0;
  const pctFacturx = totalPieces > 0 ? Math.round((structurees / totalPieces) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
      {/* 1. Total Pièces */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Pièces Reçues</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{totalPieces}</div>
            <Badge variant="outline" className="text-xs">
              {stats?.dossiers ?? 7} dossiers
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs">{stats?.restants ?? 0} email(s) en attente dans la boîte</p>
        </CardContent>
      </Card>

      {/* 2. Factur-X / Lues */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileCheck2 className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Factur-X Validées</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight text-emerald-600 dark:text-emerald-400">
              {lues}
            </div>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">{pctFacturx}% Factur-X</Badge>
          </div>
          <p className="text-muted-foreground text-xs">Données fiscales et lignes extraites sans saisie</p>
        </CardContent>
      </Card>

      {/* 3. À Vérifier */}
      <Card className={aVerifier > 0 ? "border-amber-500/40" : ""}>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>À Contrôler / OCR</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`font-medium text-3xl tabular-nums leading-none tracking-tight ${aVerifier > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
            >
              {aVerifier}
            </div>
            {aVerifier > 0 ? (
              <Badge variant="destructive" className="bg-amber-600 hover:bg-amber-700 text-white">
                Action requise
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-emerald-600">
                <CheckCircle2 className="size-3" /> À jour
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">Tickets de caisse ou documents non structurés</p>
        </CardContent>
      </Card>

      {/* 4. Exportées vers Sage */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Send className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Exportées vers Sage</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight text-blue-600 dark:text-blue-400">
              {exportees}
            </div>
            <Link href="/dashboard/sage">
              <Badge variant="outline" className="cursor-pointer hover:bg-muted text-xs">
                Format Sage 100/1000 &rarr;
              </Badge>
            </Link>
          </div>
          <p className="text-muted-foreground text-xs">Écritures comptables générées en CSV Windows-1252</p>
        </CardContent>
      </Card>
    </div>
  );
}

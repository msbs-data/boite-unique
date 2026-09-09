"use client";

import * as React from "react";

import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  MailQuestion,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Quarantaine } from "@/lib/api-client";
import { useCabinetStore } from "@/stores/cabinet-store";

export function QuarantainePage() {
  const { fetchStats } = useCabinetStore();
  const [quarantaine, setQuarantaine] = React.useState<Quarantaine[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isClearing, setIsClearing] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getQuarantaine();
      setQuarantaine(data);
    } catch (err) {
      console.error("Erreur chargement quarantaine:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleVider = async () => {
    try {
      setIsClearing(true);
      const res = await api.viderQuarantaine();
      toast.success(res.message || "Quarantaine vidée avec succès.");
      await loadData();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la vidange.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg tracking-tight">Zone de Sécurité & Quarantaine</h1>
            <Badge variant={quarantaine.length > 0 ? "destructive" : "secondary"} className="gap-1 font-mono text-xs">
              <ShieldAlert className="size-3" />
              {quarantaine.length} élément{quarantaine.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Messages sans alias client identifiable dans les en-têtes (X-Original-To, To, Cc)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {quarantaine.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1.5">
                  <Trash2 className="size-4" />
                  Vider la quarantaine
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Vider tous les messages en quarantaine ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette opération supprimera définitivement les éléments actuellement mis en quarantaine.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleVider}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmer la suppression
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button variant="ghost" size="icon-sm" onClick={loadData} title="Rafraîchir" disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Guide explicatif */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-foreground">Pourquoi un message arrive-t-il en quarantaine ?</div>
            <p className="text-muted-foreground leading-relaxed">
              Pour éviter qu'une facture ne soit attribuée par erreur au mauvais client, le moteur inspecte dans l'ordre
              strict les en-têtes de routage :{" "}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">X-Original-To</code>,{" "}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">Delivered-To</code>,{" "}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">To</code> et{" "}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">Cc</code>. Si aucune adresse ne correspond à un
              alias déclaré ni à un compte attrape-tout, le message est isolé ici sans perte de données.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des quarantaines */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Chargement de la quarantaine...</div>
          ) : quarantaine.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-3">
                <CheckCircle2 className="size-6" />
              </div>
              <p className="text-sm font-semibold">Aucun message en quarantaine</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Tous les flux entrants ont été correctement aiguillés vers leurs dossiers clients respectifs.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">N°</TableHead>
                  <TableHead>Fichier / Objet</TableHead>
                  <TableHead>Date réception</TableHead>
                  <TableHead>Expéditeur</TableHead>
                  <TableHead>Adresses Examinées</TableHead>
                  <TableHead>Motif d'isolement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quarantaine.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">#{q.id}</TableCell>
                    <TableCell className="font-medium text-xs">{q.nom_fichier}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {q.recue_le?.replace("T", " à ").slice(0, 19)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {q.expediteur || <span className="italic text-muted-foreground">Inconnu</span>}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {q.adresses_examinees}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                      >
                        {q.motif}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default QuarantainePage;

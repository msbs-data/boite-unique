"use client";

import * as React from "react";

import { DownloadCloud, FileUp, Inbox, Loader2, Mail, RefreshCcw, RotateCcw, Sparkles } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type Dossier } from "@/lib/api-client";
import { useCabinetStore } from "@/stores/cabinet-store";

export function DashboardActions() {
  const { stats, isReceiving, isResetting, recevoirEmails, reinitialiser, fetchStats } = useCabinetStore();

  const [dossiers, setDossiers] = React.useState<Dossier[]>([]);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [selectedDossier, setSelectedDossier] = React.useState("");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    fetchStats();
    api.getDossiers().then(setDossiers).catch(console.error);
  }, [fetchStats]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Veuillez sélectionner un fichier.");
      return;
    }

    const isEml = uploadFile.name.toLowerCase().endsWith(".eml");
    if (!isEml && !selectedDossier) {
      toast.error("Veuillez sélectionner un dossier client pour les fichiers PDF/images.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("fichier", uploadFile);
      if (selectedDossier) {
        formData.append("dossier", selectedDossier);
      }

      const res = await api.deposerFichier(formData);
      toast.success(res.message || "Fichier déposé et traité avec succès.");
      setIsUploadOpen(false);
      setUploadFile(null);
      setSelectedDossier("");
      await fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du dépôt du fichier.");
    } finally {
      setIsUploading(false);
    }
  };

  const restants = stats?.restants ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card/60 p-4 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg tracking-tight">Pilote des flux comptables</h2>
          {restants > 0 ? (
            <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Mail className="size-3" />
              {restants} email(s) en attente
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3" />À jour
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Simulez les arrivées de courriels, contrôlez les extractions Factur-X et préparez les écritures Sage.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isReceiving || restants === 0}
          onClick={() => recevoirEmails(false)}
          className="gap-1.5"
        >
          {isReceiving ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4 text-primary" />}
          Recevoir le prochain mail
        </Button>

        <Button
          size="sm"
          disabled={isReceiving || restants === 0}
          onClick={() => recevoirEmails(true)}
          className="gap-1.5"
        >
          {isReceiving ? <Loader2 className="size-4 animate-spin" /> : <Inbox className="size-4" />}
          Tout relever ({restants})
        </Button>

        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <FileUp className="size-4" />
              Déposer une pièce
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <form onSubmit={handleUpload}>
              <DialogHeader>
                <DialogTitle>Déposer une pièce ou un email</DialogTitle>
                <DialogDescription>
                  Importez un fichier Factur-X (.pdf), un email brut (.eml) ou une facture scannée (.jpg, .png).
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="fichier">Fichier à importer</Label>
                  <Input
                    id="fichier"
                    type="file"
                    accept=".pdf,.eml,.jpg,.jpeg,.png,.txt,.xml"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
                    }}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Les fichiers .eml sont automatiquement routés par analyse des en-têtes. Pour un PDF/image,
                    sélectionnez le dossier client ci-dessous.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dossier">Dossier client (facultatif si .eml)</Label>
                  <Select value={selectedDossier} onValueChange={setSelectedDossier}>
                    <SelectTrigger id="dossier">
                      <SelectValue placeholder="Sélectionner un dossier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dossiers.map((d) => (
                        <SelectItem key={d.code} value={d.code}>
                          {d.code} — {d.raison_sociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isUploading || !uploadFile} className="gap-2">
                  {isUploading && <Loader2 className="size-4 animate-spin" />}
                  Traiter la pièce
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" title="Réinitialiser la démonstration" disabled={isResetting}>
              <RotateCcw className={`size-4 ${isResetting ? "animate-spin" : ""}`} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Réinitialiser toutes les données ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action efface la base PostgreSQL (pièces, extractions, exports Sage) et remet en boîte de
                réception tous les messages échantillons pour recommencer la démonstration depuis zéro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={reinitialiser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Réinitialiser
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

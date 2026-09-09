"use client";

import * as React from "react";

import Link from "next/link";

import { ArrowRight, CheckCircle2, FolderPlus, Mail, Plus, RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Dossier } from "@/lib/api-client";
import { useCabinetStore } from "@/stores/cabinet-store";

export default function DossiersPage() {
  const { fetchStats } = useCabinetStore();
  const [dossiers, setDossiers] = React.useState<Dossier[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Create modal state
  const [isOpen, setIsOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [raisonSociale, setRaisonSociale] = React.useState("");
  const [alias, setAlias] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadDossiers = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDossiers();
      setDossiers(data);
    } catch (err) {
      console.error("Erreur chargement dossiers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDossiers();
  }, [loadDossiers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !raisonSociale || !alias) {
      toast.error("Veuillez renseigner tous les champs.");
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await api.createDossier({
        code: code.trim().toUpperCase(),
        raison_sociale: raisonSociale.trim(),
        alias: alias.trim().toLowerCase(),
      });
      toast.success(`Dossier ${created.code} créé avec succès.`);
      setIsOpen(false);
      setCode("");
      setRaisonSociale("");
      setAlias("");
      await loadDossiers();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création du dossier.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDossiers = dossiers.filter((d) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      d.code.toLowerCase().includes(q) ||
      d.raison_sociale.toLowerCase().includes(q) ||
      d.alias.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg tracking-tight">Dossiers Clients & Alias de Routage</h1>
            <Badge variant="outline" className="font-mono text-xs">
              {dossiers.length} entreprise{dossiers.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Adresses emails dédiées (@cabinet-demo.fr) assurant l'aiguillage automatique vers le bon compte client
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <FolderPlus className="size-4" />
                Nouveau dossier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Ajouter un dossier client</DialogTitle>
                  <DialogDescription>
                    Créez un nouvel alias de routage pour recevoir automatiquement les factures d'achat du client.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="code">Code client (ex: DUPONT-TRA)</Label>
                    <Input
                      id="code"
                      placeholder="VELLARD-TOI"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="raison">Raison sociale</Label>
                    <Input
                      id="raison"
                      placeholder="SARL Dupont Transports"
                      value={raisonSociale}
                      onChange={(e) => setRaisonSociale(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="alias">Alias email de réception</Label>
                    <Input
                      id="alias"
                      placeholder="dupont@cabinet-demo.fr"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    Créer le dossier
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="ghost" size="icon-sm" onClick={loadDossiers} title="Rafraîchir" disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Barre de recherche */}
      <Card>
        <CardContent className="p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher code, raison sociale ou alias email..."
              className="pl-8 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tableau des dossiers */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Chargement des dossiers...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Code Dossier</TableHead>
                  <TableHead>Raison Sociale</TableHead>
                  <TableHead>Adresse Email Dédiée (Routage)</TableHead>
                  <TableHead className="w-[100px]">Statut</TableHead>
                  <TableHead className="text-right w-[160px]">Accès rapide</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDossiers.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono font-semibold text-xs">
                      <Badge variant="secondary" className="font-mono">
                        {d.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{d.raison_sociale}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-xs text-primary">
                        <Mail className="size-3.5 text-muted-foreground" />
                        {d.alias}
                      </div>
                    </TableCell>
                    <TableCell>
                      {d.actif ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[11px]"
                        >
                          <CheckCircle2 className="size-2.5" /> Actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                        <Link href={`/dashboard/pieces?dossier=${d.code}`}>
                          Voir les pièces
                          <ArrowRight className="size-3" />
                        </Link>
                      </Button>
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

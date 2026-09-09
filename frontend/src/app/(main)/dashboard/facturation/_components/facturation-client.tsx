"use client";

import * as React from "react";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  api,
  type FactureHonoraires,
  type LigneReleve,
  type SaisieTemps,
  type SyntheseFacturation,
} from "@/lib/api-client";

const HEURES_PAR_JOUR = 7;

const eur = (n: number) =>
  n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
const heures = (n: number) =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;

function EtatFacture({ etat, retard }: { etat: string; retard?: number }) {
  const styles: Record<string, string> = {
    brouillon: "bg-muted text-muted-foreground",
    envoyee: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    encaissee: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    partielle: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    impayee: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  const libelles: Record<string, string> = {
    brouillon: "Brouillon",
    envoyee: "Envoyée",
    encaissee: "Encaissée",
    partielle: "Partiellement réglée",
    impayee: "Impayée",
  };
  return (
    <Badge variant="secondary" className={styles[etat] ?? ""}>
      {libelles[etat] ?? etat}
      {etat === "impayee" && retard ? ` · ${retard} j` : ""}
    </Badge>
  );
}

function Rapprochement({ niveau }: { niveau: string }) {
  if (niveau === "exact")
    return (
      <Badge
        variant="secondary"
        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        Certain
      </Badge>
    );
  if (niveau === "manuel")
    return (
      <Badge
        variant="secondary"
        className="bg-sky-500/10 text-sky-600 dark:text-sky-400"
      >
        Attribuée à la main
      </Badge>
    );
  if (niveau === "approchant")
    return (
      <Badge
        variant="secondary"
        className="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        Par le montant
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      À attribuer
    </Badge>
  );
}

/** Une valeur qu'on corrige sur place : clic, saisie, Entrée. */
function ChampEditable({
  valeur,
  suffixe,
  pas = "0.5",
  largeur = "w-20",
  onValider,
  desactive,
  titreDesactive,
}: {
  valeur: number;
  suffixe?: string;
  pas?: string;
  largeur?: string;
  onValider: (v: number) => Promise<void> | void;
  desactive?: boolean;
  titreDesactive?: string;
}) {
  const [edition, setEdition] = React.useState(false);
  const [brouillon, setBrouillon] = React.useState(String(valeur));

  React.useEffect(() => setBrouillon(String(valeur)), [valeur]);

  if (desactive) {
    return (
      <span
        className="text-muted-foreground cursor-not-allowed font-mono tabular-nums"
        title={titreDesactive}
      >
        {valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
        {suffixe}
      </span>
    );
  }

  if (!edition) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEdition(true);
        }}
        className="hover:bg-muted focus-visible:ring-ring rounded px-1.5 py-0.5 font-mono tabular-nums focus-visible:ring-2 focus-visible:outline-none"
        title="Cliquer pour corriger"
      >
        {valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
        {suffixe}
      </button>
    );
  }

  const valider = async () => {
    const v = parseFloat(brouillon.replace(",", "."));
    setEdition(false);
    if (!Number.isFinite(v) || v <= 0 || v === valeur) {
      setBrouillon(String(valeur));
      return;
    }
    await onValider(v);
  };

  return (
    <Input
      autoFocus
      type="number"
      step={pas}
      min="0"
      value={brouillon}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setBrouillon(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") void valider();
        if (e.key === "Escape") {
          setBrouillon(String(valeur));
          setEdition(false);
        }
      }}
      className={`${largeur} h-7 px-2 text-right font-mono tabular-nums`}
    />
  );
}

export function FacturationClient() {
  const [synthese, setSynthese] = React.useState<SyntheseFacturation | null>(
    null,
  );
  const [factures, setFactures] = React.useState<FactureHonoraires[]>([]);
  const [releve, setReleve] = React.useState<LigneReleve[]>([]);
  const [lignesTemps, setLignesTemps] = React.useState<SaisieTemps[]>([]);
  const [nouvelle, setNouvelle] = React.useState<{
    jour: string;
    heures: string;
    libelle: string;
  }>({
    jour: new Date().toISOString().slice(0, 10),
    heures: "1",
    libelle: "",
  });
  const [chargement, setChargement] = React.useState(true);
  const [enCours, setEnCours] = React.useState<string | null>(null);
  const [ouvert, setOuvert] = React.useState<string | null>(null);

  const recharger = React.useCallback(async () => {
    try {
      const [s, f, r, t] = await Promise.all([
        api.getSynthese(),
        api.getFactures(),
        api.getReleve(),
        api.getTemps(),
      ]);
      setSynthese(s);
      setFactures(f);
      setReleve(r);
      setLignesTemps(t);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }, []);

  React.useEffect(() => {
    void recharger();
  }, [recharger]);

  const agir = async (
    cle: string,
    action: () => Promise<{ message: string }>,
  ) => {
    setEnCours(cle);
    try {
      const res = await action();
      toast.success(res.message);
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setEnCours(null);
    }
  };

  const ecrire = async (action: () => Promise<unknown>, succes?: string) => {
    try {
      await action();
      if (succes) toast.success(succes);
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification impossible");
    }
  };

  const ajouterLigne = async (dossierCode: string, taux: number) => {
    const h = parseFloat(nouvelle.heures.replace(",", "."));
    if (!Number.isFinite(h) || h <= 0) {
      toast.error("Saisissez un nombre d'heures valide.");
      return;
    }
    await ecrire(
      () =>
        api.saisirTemps({
          dossier_code: dossierCode,
          jour: nouvelle.jour,
          heures: h,
          taux_horaire: taux,
          libelle: nouvelle.libelle || undefined,
          saisi_par: "M. Loiseau",
        }),
      "Temps pointé.",
    );
    setNouvelle((n) => ({ ...n, heures: "1", libelle: "" }));
  };

  const brouillons = factures.filter((f) => f.etat === "brouillon");
  const impayees = factures.filter((f) =>
    ["envoyee", "partielle", "impayee"].includes(f.etat),
  );
  const encaisse = factures.reduce((s, f) => s + f.montant_encaisse, 0);
  const attendu = factures.reduce((s, f) => s + f.reste_du, 0);

  if (chargement) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Chargement de la facturation...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Facturation client
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Le temps passé sur chaque dossier devient une facture, puis un
            encaissement constaté sur le relevé bancaire du cabinet. Une heure
            déjà facturée ne repart jamais dans une facture suivante.
          </p>
        </div>
        <div className="text-muted-foreground text-right text-xs">
          Période
          <div className="text-foreground font-mono text-base">
            {synthese?.periode}
          </div>
        </div>
      </div>

      {/* ── chiffres du mois ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          {
            l: "Temps pointé",
            v: heures(synthese?.total_heures ?? 0),
            s: `${((synthese?.total_heures ?? 0) / HEURES_PAR_JOUR).toFixed(1)} jours`,
          },
          {
            l: "Honoraires du mois",
            v: eur(synthese?.total_ht ?? 0),
            s: `${eur(synthese?.total_ttc ?? 0)} TTC`,
          },
          {
            l: "Pas encore facturé",
            v: eur(synthese?.total_a_facturer ?? 0),
            s: `${synthese?.dossiers_pointes ?? 0} dossiers pointés`,
          },
          {
            l: "Encaissé",
            v: eur(encaisse),
            s: `${factures.filter((f) => f.etat === "encaissee").length} facture(s) réglée(s)`,
          },
          {
            l: "Reste dû",
            v: eur(attendu),
            s: `${impayees.length} en attente`,
          },
        ].map((c) => (
          <Card key={c.l} className="gap-1 py-4">
            <CardHeader className="px-4 pb-0">
              <CardDescription className="text-xs">{c.l}</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <div className="font-mono text-xl font-medium tracking-tight tabular-nums">
                {c.v}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">{c.s}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="temps">
        <TabsList>
          <TabsTrigger value="temps">Temps par client</TabsTrigger>
          <TabsTrigger value="factures">
            Factures{brouillons.length ? ` (${brouillons.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="encaissement">Encaissement</TabsTrigger>
        </TabsList>

        {/* ─────────────── 1. temps ─────────────── */}
        <TabsContent value="temps" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  Temps passé par dossier
                </CardTitle>
                <CardDescription>
                  Coût horaire, montant du mois et ventilation par semaine.
                  Cliquez une ligne pour la détailler.
                </CardDescription>
              </div>
              <Button
                onClick={() => agir("generer", () => api.genererFactures())}
                disabled={
                  enCours !== null || (synthese?.total_a_facturer ?? 0) === 0
                }
              >
                {enCours === "generer"
                  ? "Génération..."
                  : "Générer les factures"}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Heures</TableHead>
                    <TableHead className="text-right">Jours</TableHead>
                    <TableHead className="text-right">Coût horaire</TableHead>
                    <TableHead className="text-right">Montant HT</TableHead>
                    <TableHead className="text-right">À facturer</TableHead>
                    <TableHead>Facture</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(synthese?.lignes ?? []).map((l) => (
                    <React.Fragment key={l.dossier_code}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() =>
                          setOuvert(
                            ouvert === l.dossier_code ? null : l.dossier_code,
                          )
                        }
                      >
                        <TableCell>
                          <div className="font-medium">{l.raison_sociale}</div>
                          <div className="text-muted-foreground font-mono text-xs">
                            {l.dossier_code}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {heures(l.heures)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                          {l.jours.toFixed(1)}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ChampEditable
                            valeur={l.taux_horaire}
                            suffixe=" €"
                            pas="5"
                            desactive={l.heures_a_facturer === 0}
                            titreDesactive="Tout le temps du mois est déjà facturé : le coût horaire ne peut plus changer."
                            onValider={(v) =>
                              ecrire(
                                () => api.appliquerTaux(l.dossier_code, v),
                                `Coût horaire porté à ${eur(v)} sur le temps non facturé.`,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">
                          {eur(l.montant_ht)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {l.montant_a_facturer > 0 ? (
                            eur(l.montant_a_facturer)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {l.facture_numero ? (
                            <span className="font-mono text-xs">
                              {l.facture_numero}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              à émettre
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                      {ouvert === l.dossier_code && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="bg-muted/40">
                            <div className="flex flex-col gap-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                {l.semaines.map((sem) => (
                                  <div
                                    key={sem.semaine}
                                    className="bg-background rounded-md border px-3 py-2"
                                  >
                                    <div className="text-muted-foreground text-xs">
                                      {sem.semaine} · du {sem.du}
                                    </div>
                                    <div className="font-mono text-sm tabular-nums">
                                      {heures(sem.heures)} · {eur(sem.montant)}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="bg-background rounded-md border">
                                <div className="text-muted-foreground border-b px-3 py-2 text-xs">
                                  Lignes de temps — cliquez une valeur pour la
                                  corriger. Une ligne déjà facturée est
                                  verrouillée.
                                </div>
                                <div className="divide-y">
                                  {lignesTemps
                                    .filter(
                                      (t) => t.dossier_code === l.dossier_code,
                                    )
                                    .map((t) => (
                                      <div
                                        key={t.id}
                                        className="grid grid-cols-[92px_1fr_88px_92px_100px_36px] items-center gap-2 px-3 py-1.5 text-sm"
                                      >
                                        <span className="text-muted-foreground font-mono text-xs">
                                          {t.jour}
                                        </span>
                                        <span className="truncate text-xs">
                                          {t.libelle ?? (
                                            <span className="text-muted-foreground">
                                              sans libellé
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-right">
                                          <ChampEditable
                                            valeur={t.heures}
                                            suffixe=" h"
                                            largeur="w-16"
                                            desactive={t.facturee}
                                            titreDesactive="Ligne facturée : verrouillée."
                                            onValider={(v) =>
                                              ecrire(
                                                () =>
                                                  api.modifierTemps(t.id, {
                                                    heures: v,
                                                  }),
                                                "Ligne corrigée.",
                                              )
                                            }
                                          />
                                        </span>
                                        <span className="text-right">
                                          <ChampEditable
                                            valeur={t.taux_horaire}
                                            suffixe=" €"
                                            pas="5"
                                            largeur="w-20"
                                            desactive={t.facturee}
                                            titreDesactive="Ligne facturée : verrouillée."
                                            onValider={(v) =>
                                              ecrire(
                                                () =>
                                                  api.modifierTemps(t.id, {
                                                    taux_horaire: v,
                                                  }),
                                                "Coût horaire corrigé.",
                                              )
                                            }
                                          />
                                        </span>
                                        <span className="text-right font-mono text-xs tabular-nums">
                                          {eur(t.montant)}
                                        </span>
                                        <span className="text-right">
                                          {t.facturee ? (
                                            <span
                                              className="text-muted-foreground text-xs"
                                              title="Ligne facturée"
                                            >
                                              ×
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              className="text-muted-foreground hover:text-destructive text-xs"
                                              title="Supprimer cette ligne"
                                              onClick={() =>
                                                ecrire(
                                                  () =>
                                                    api.supprimerTemps(t.id),
                                                  "Ligne supprimée.",
                                                )
                                              }
                                            >
                                              Suppr.
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                </div>

                                <div className="bg-muted/30 grid grid-cols-[92px_1fr_88px_92px_136px] items-center gap-2 border-t px-3 py-2">
                                  <Input
                                    type="date"
                                    value={nouvelle.jour}
                                    onChange={(e) =>
                                      setNouvelle((n) => ({
                                        ...n,
                                        jour: e.target.value,
                                      }))
                                    }
                                    className="h-7 px-2 font-mono text-xs"
                                  />
                                  <Input
                                    placeholder="Libellé (révision, TVA, point client...)"
                                    value={nouvelle.libelle}
                                    onChange={(e) =>
                                      setNouvelle((n) => ({
                                        ...n,
                                        libelle: e.target.value,
                                      }))
                                    }
                                    className="h-7 px-2 text-xs"
                                  />
                                  <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={nouvelle.heures}
                                    onChange={(e) =>
                                      setNouvelle((n) => ({
                                        ...n,
                                        heures: e.target.value,
                                      }))
                                    }
                                    className="h-7 px-2 text-right font-mono text-xs"
                                  />
                                  <span className="text-muted-foreground text-right font-mono text-xs">
                                    {eur(l.taux_horaire)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7"
                                    onClick={() =>
                                      ajouterLigne(
                                        l.dossier_code,
                                        l.taux_horaire,
                                      )
                                    }
                                  >
                                    Pointer
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  {(synthese?.lignes.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Aucun temps pointé sur la période.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── 2. factures ─────────────── */}
        <TabsContent value="factures" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  Factures d&apos;honoraires
                </CardTitle>
                <CardDescription>
                  Envoyées à l&apos;adresse du dossier. Échéance à 30 jours.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={enCours !== null || impayees.length === 0}
                  onClick={() =>
                    agir("relancer", () =>
                      api.relancerFactures(impayees.map((f) => f.id)),
                    )
                  }
                >
                  Relancer les impayées
                </Button>
                <Button
                  disabled={enCours !== null || brouillons.length === 0}
                  onClick={() =>
                    agir("envoyer", () =>
                      api.envoyerFactures(brouillons.map((f) => f.id)),
                    )
                  }
                >
                  {enCours === "envoyer"
                    ? "Envoi..."
                    : `Envoyer (${brouillons.length})`}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Heures</TableHead>
                    <TableHead className="text-right">HT</TableHead>
                    <TableHead className="text-right">TTC</TableHead>
                    <TableHead className="text-right">Encaissé</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factures.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">
                          {f.numero}
                        </div>
                        {f.relances > 0 && (
                          <div className="text-muted-foreground text-xs">
                            {f.relances} relance(s)
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{f.raison_sociale}</div>
                        <div className="text-muted-foreground text-xs">
                          {f.envoyee_a ?? f.alias}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {heures(f.heures)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {eur(f.montant_ht)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium tabular-nums">
                        {eur(f.montant_ttc)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {f.montant_encaisse > 0 ? (
                          eur(f.montant_encaisse)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {f.echeance_le}
                      </TableCell>
                      <TableCell>
                        <EtatFacture etat={f.etat} retard={f.jours_retard} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {factures.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Aucune facture. Générez-les depuis l&apos;onglet
                        précédent.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── 3. encaissement ─────────────── */}
        <TabsContent value="encaissement" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  Relevé bancaire du cabinet
                </CardTitle>
                <CardDescription>
                  Le rapprochement se fait sur le relevé que votre banque vous
                  fournit — aucun agrégateur, aucun abonnement, aucune donnée
                  qui sort du cabinet.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={enCours !== null}
                  onClick={() => agir("releve", () => api.simulerReleve())}
                >
                  Recevoir le relevé
                </Button>
                <Button
                  disabled={enCours !== null}
                  onClick={() => agir("rapprocher", () => api.rapprocher())}
                >
                  {enCours === "rapprocher" ? "Rapprochement..." : "Rapprocher"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead>Rapprochement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releve.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {l.jour}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {l.libelle}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono tabular-nums ${l.montant < 0 ? "text-muted-foreground" : ""}`}
                      >
                        {eur(l.montant)}
                      </TableCell>
                      <TableCell>
                        <select
                          value={
                            factures.find((f) => f.numero === l.facture_numero)
                              ?.id ?? ""
                          }
                          onChange={(e) =>
                            ecrire(
                              () =>
                                api.attribuerLigne(
                                  l.id,
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                ),
                              e.target.value
                                ? "Ligne attribuée."
                                : "Attribution retirée.",
                            )
                          }
                          disabled={l.montant <= 0}
                          className="border-input bg-background disabled:text-muted-foreground h-7 w-full max-w-44 rounded-md border px-2 font-mono text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">
                            {l.montant <= 0
                              ? "— décaissement —"
                              : "non attribuée"}
                          </option>
                          {factures
                            .filter((f) => f.etat !== "brouillon")
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.numero} · {f.raison_sociale.slice(0, 18)}
                              </option>
                            ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Rapprochement niveau={l.rapprochement} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {releve.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Aucun mouvement. Importez le relevé de votre banque.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="text-muted-foreground border-l-2 pl-4 text-xs leading-relaxed">
            <p className="mb-1">
              <span className="text-foreground font-medium">Certain</span> : le
              numéro de facture est cité dans le libellé du virement.{" "}
              <span className="text-foreground font-medium">
                Par le montant
              </span>{" "}
              : une seule facture ouverte correspond au centime près.{" "}
              <span className="text-foreground font-medium">À attribuer</span> :
              un acompte, ou plusieurs factures possibles. Choisissez la facture
              dans la liste : c&apos;est le seul cas où l&apos;outil vous laisse
              trancher, parce qu&apos;il n&apos;a aucun moyen de le faire sans
              se tromper.
            </p>
            <p>
              L&apos;outil constate les encaissements, il ne touche jamais les
              fonds. Le prélèvement, lui, passe par votre banque ou un
              prestataire agréé.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

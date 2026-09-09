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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type ExportPaie, type MessagePaie } from "@/lib/api-client";
import { nombre } from "@/lib/format";

const CANAUX: Record<string, { nom: string; classe: string }> = {
  whatsapp: {
    nom: "WhatsApp",
    classe: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  gmail: {
    nom: "Courriel",
    classe: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  telegram: {
    nom: "Telegram",
    classe: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
};

const EXEMPLES = [
  {
    canal: "whatsapp",
    expediteur: "+33 6 12 34 56 78 — Jean-Marc Vellard",
    dossier_code: "VELLARD-TOI",
    contenu:
      "Bonjour, pour Karim ce mois-ci : 12h supp et 18 paniers. Il a eu 2 jours d arret la semaine du 14.",
  },
  {
    canal: "telegram",
    expediteur: "@bakkali_transports",
    dossier_code: "BAKKALI-TRA",
    contenu:
      "Salut ! Pour Mehdi : 46h supp ce mois (grosse periode). 21 paniers.",
  },
  {
    canal: "gmail",
    expediteur: "compta@boulangerie-ferrand.fr",
    dossier_code: "FERRAND-BOU",
    contenu:
      "Bonjour,\n\nVariables de septembre pour Sophie : 6 heures supplementaires, 15 paniers, et une prime de 250 euros.\n\nCordialement",
  },
];

function Jauge({ v }: { v: number }) {
  const sur = v >= 0.85;
  return (
    <span
      className={`font-mono text-xs tabular-nums ${sur ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
    >
      {Math.round(v * 100)} %
    </span>
  );
}

export function PaieClient() {
  const [messages, setMessages] = React.useState<MessagePaie[]>([]);
  const [fichier, setFichier] = React.useState<ExportPaie | null>(null);
  const [chargement, setChargement] = React.useState(true);
  const [occupe, setOccupe] = React.useState(false);

  const recharger = React.useCallback(async () => {
    try {
      const [m, f] = await Promise.all([
        api.getMessagesPaie(),
        api.getExportPaie(),
      ]);
      setMessages(m);
      setFichier(f);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }, []);

  React.useEffect(() => {
    void recharger();
  }, [recharger]);

  const agir = async (action: () => Promise<unknown>, succes?: string) => {
    setOccupe(true);
    try {
      const r = (await action()) as { message?: string } | undefined;
      toast.success(succes ?? r?.message ?? "Fait.");
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setOccupe(false);
    }
  };

  const aTraiter = messages.filter((m) =>
    ["propose", "a_lire"].includes(m.etat),
  );
  const valides = messages.filter((m) => m.etat === "valide");
  const douteuses = aTraiter
    .flatMap((m) => m.variables)
    .filter((v) => v.confiance < 0.85).length;

  if (chargement) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Chargement de la collecte...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Paie — collecte des variables
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Vos clients écrivent là où ils ont l&apos;habitude d&apos;écrire.
            L&apos;agent lit, propose, et cite toujours la phrase
            d&apos;origine. Rien ne part vers le logiciel de paie sans que vous
            l&apos;ayez vu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            l: "Messages à traiter",
            v: String(aTraiter.length),
            s: "trois canaux confondus",
          },
          {
            l: "Variables proposées",
            v: String(aTraiter.flatMap((m) => m.variables).length),
            s: "en attente de validation",
          },
          {
            l: "À vérifier",
            v: String(douteuses),
            s: "sous 85 % de certitude",
          },
          {
            l: "Prêtes pour la paie",
            v: String(fichier?.nb ?? 0),
            s: "validées, exportables",
          },
        ].map((c) => (
          <Card key={c.l} className="gap-1 py-4">
            <CardHeader className="px-4 pb-0">
              <CardDescription className="text-xs">{c.l}</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <div className="font-mono text-xl font-medium tabular-nums">
                {c.v}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">{c.s}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="boite">
        <TabsList>
          <TabsTrigger value="boite">
            À traiter{aTraiter.length ? ` (${aTraiter.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="simuler">Recevoir un message</TabsTrigger>
          <TabsTrigger value="export">Fichier de paie</TabsTrigger>
        </TabsList>

        {/* ── à traiter ── */}
        <TabsContent value="boite" className="mt-4 flex flex-col gap-3">
          {aTraiter.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Rien à traiter. {valides.length} message(s) déjà validé(s) ce
                mois-ci.
              </CardContent>
            </Card>
          )}
          {aTraiter.map((m) => (
            <Card key={m.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={CANAUX[m.canal]?.classe}
                    >
                      {CANAUX[m.canal]?.nom ?? m.canal}
                    </Badge>
                    <CardTitle className="text-base">
                      {m.raison_sociale ?? "Dossier non identifié"}
                    </CardTitle>
                    <span className="text-muted-foreground font-mono text-xs">
                      {m.expediteur}
                    </span>
                  </div>
                  <CardDescription className="bg-muted/50 mt-2 rounded-md border-l-2 p-3 text-sm whitespace-pre-wrap">
                    {m.contenu}
                  </CardDescription>
                </div>
                <div className="flex flex-none gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={occupe}
                    onClick={() => agir(() => api.ecarterMessagePaie(m.id))}
                  >
                    Écarter
                  </Button>
                  <Button
                    size="sm"
                    disabled={occupe || m.variables.length === 0}
                    onClick={() => agir(() => api.validerMessagePaie(m.id))}
                  >
                    Valider
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {m.remarque && (
                  <div className="text-muted-foreground text-sm">
                    {m.remarque}
                  </div>
                )}
                <div className="divide-y">
                  {m.variables.map((v) => (
                    <div
                      key={v.id}
                      className="grid grid-cols-[1fr_auto] items-start gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium">{v.salarie}</span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {v.code}
                          </span>
                          <span className="text-sm">{v.libelle}</span>
                          <Jauge v={v.confiance} />
                        </div>
                        {v.extrait && (
                          <div className="text-muted-foreground mt-1 truncate font-mono text-xs italic">
                            {v.extrait}
                          </div>
                        )}
                        {v.alerte && (
                          <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            {v.alerte}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.5"
                          defaultValue={v.valeur}
                          disabled={v.validee}
                          onBlur={(e) => {
                            const n = parseFloat(
                              e.target.value.replace(",", "."),
                            );
                            if (Number.isFinite(n) && n !== v.valeur) {
                              void agir(
                                () => api.corrigerVariablePaie(v.id, n),
                                "Valeur corrigée.",
                              );
                            }
                          }}
                          className="h-8 w-24 text-right font-mono tabular-nums"
                        />
                        <span className="text-muted-foreground w-14 text-xs">
                          {v.unite}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── simuler ── */}
        <TabsContent value="simuler" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recevoir un message</CardTitle>
              <CardDescription>
                En production, les messages arrivent d&apos;eux-mêmes par les
                connecteurs des trois canaux. Ici, collez-en un pour voir ce que
                l&apos;agent en tire.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {EXEMPLES.map((e) => (
                  <Button
                    key={e.dossier_code}
                    variant="outline"
                    size="sm"
                    disabled={occupe}
                    onClick={() => agir(() => api.recevoirMessagePaie(e))}
                  >
                    {CANAUX[e.canal]?.nom} · {e.dossier_code}
                  </Button>
                ))}
              </div>
              <FormulaireLibre
                onEnvoi={(d) => agir(() => api.recevoirMessagePaie(d))}
                occupe={occupe}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── export ── */}
        <TabsContent value="export" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Fichier pour le logiciel de paie
              </CardTitle>
              <CardDescription>
                {fichier?.avertissement ??
                  `${fichier?.nb ?? 0} variable(s) validée(s) — ${fichier?.fichier}. Seules les variables que vous avez vues y figurent.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted/40 overflow-x-auto rounded-md border p-4 font-mono text-xs leading-relaxed">
                {fichier?.contenu}
              </pre>
              <p className="text-muted-foreground mt-3 text-xs">
                {nombre(fichier?.nb ?? 0)} ligne(s). Le format est celui attendu
                par OpenPaye — codes HS025, ABS100, PAN010, PRI200.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FormulaireLibre({
  onEnvoi,
  occupe,
}: {
  onEnvoi: (d: {
    canal: string;
    expediteur: string;
    contenu: string;
    dossier_code?: string;
  }) => void;
  occupe: boolean;
}) {
  const [canal, setCanal] = React.useState("whatsapp");
  const [expediteur, setExpediteur] = React.useState("+33 6 00 00 00 00");
  const [dossier, setDossier] = React.useState("VELLARD-TOI");
  const [contenu, setContenu] = React.useState("");

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="gmail">Courriel</option>
          <option value="telegram">Telegram</option>
        </select>
        <Input
          value={expediteur}
          onChange={(e) => setExpediteur(e.target.value)}
          placeholder="Expéditeur"
          className="h-9 max-w-64"
        />
        <Input
          value={dossier}
          onChange={(e) => setDossier(e.target.value.toUpperCase())}
          placeholder="Code dossier"
          className="h-9 max-w-44 font-mono"
        />
      </div>
      <Textarea
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        rows={3}
        placeholder="Pour Karim : 8h supp, 12 paniers, 1 jour d absence."
      />
      <div>
        <Button
          size="sm"
          disabled={occupe || contenu.trim().length === 0}
          onClick={() => {
            onEnvoi({
              canal,
              expediteur,
              contenu,
              dossier_code: dossier || undefined,
            });
            setContenu("");
          }}
        >
          Faire lire par l&apos;agent
        </Button>
      </div>
    </div>
  );
}

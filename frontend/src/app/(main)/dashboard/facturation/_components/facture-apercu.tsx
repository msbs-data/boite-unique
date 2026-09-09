"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, type FactureDetail } from "@/lib/api-client";
import { eur, jourLong, nombre } from "@/lib/format";

export function FactureApercu({
  factureId,
  onClose,
}: {
  factureId: number | null;
  onClose: () => void;
}) {
  const [f, setF] = React.useState<FactureDetail | null>(null);

  React.useEffect(() => {
    if (factureId === null) {
      setF(null);
      return;
    }
    void api.getFactureDetail(factureId).then(setF);
  }, [factureId]);

  return (
    <Dialog open={factureId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <DialogTitle className="sr-only">
          Aperçu de la facture {f?.numero}
        </DialogTitle>

        <div className="bg-background sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3 print:hidden">
          <div className="text-sm">
            <span className="font-medium">Aperçu avant impression</span>
            <span className="text-muted-foreground ml-2 text-xs">
              Imprimer, puis « Enregistrer au format PDF »
            </span>
          </div>
          <Button size="sm" onClick={() => window.print()} disabled={!f}>
            Imprimer
          </Button>
        </div>

        {f && (
          <div
            id="facture-a-imprimer"
            className="bg-white p-10 text-[13px] leading-relaxed text-neutral-900"
          >
            <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-5">
              <div>
                <div className="text-lg font-bold tracking-tight">
                  {f.emetteur.nom}
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  {f.emetteur.adresse}
                  <br />
                  SIREN {f.emetteur.siren} · TVA {f.emetteur.tva}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-base font-medium">
                  FACTURE {f.numero}
                </div>
                <div className="mt-1 font-mono text-xs text-neutral-600">
                  Émise le {jourLong(f.emise_le)}
                  <br />
                  Échéance {jourLong(f.echeance_le)}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-8">
              <div>
                <div className="text-[10px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
                  Honoraires
                </div>
                <div className="mt-1">
                  Tenue et révision comptable
                  <br />
                  <span className="text-neutral-600">Période {f.periode}</span>
                </div>
              </div>
              <div className="border-l pl-8">
                <div className="text-[10px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
                  Client
                </div>
                <div className="mt-1 font-medium">
                  {f.client.raison_sociale}
                </div>
                <div className="font-mono text-xs text-neutral-600">
                  {f.client.code}
                </div>
              </div>
            </div>

            <table className="mt-7 w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-400">
                  <th className="pb-2 text-left text-[10px] font-semibold tracking-[0.1em] text-neutral-500 uppercase">
                    Date
                  </th>
                  <th className="pb-2 text-left text-[10px] font-semibold tracking-[0.1em] text-neutral-500 uppercase">
                    Prestation
                  </th>
                  <th className="pb-2 text-right text-[10px] font-semibold tracking-[0.1em] text-neutral-500 uppercase">
                    Heures
                  </th>
                  <th className="pb-2 text-right text-[10px] font-semibold tracking-[0.1em] text-neutral-500 uppercase">
                    Taux
                  </th>
                  <th className="pb-2 text-right text-[10px] font-semibold tracking-[0.1em] text-neutral-500 uppercase">
                    Montant HT
                  </th>
                </tr>
              </thead>
              <tbody>
                {f.lignes.map((l, i) => (
                  <tr key={i} className="border-b border-neutral-200">
                    <td className="py-1.5 font-mono text-xs text-neutral-600">
                      {l.jour}
                    </td>
                    <td className="py-1.5">{l.libelle}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {nombre(l.heures)}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {eur(l.taux_horaire)}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {eur(l.montant)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 flex justify-end">
              <table className="w-72">
                <tbody>
                  <tr>
                    <td className="py-1 text-neutral-600">Total heures</td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      {nombre(f.heures)} h
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-neutral-600">Total HT</td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      {eur(f.montant_ht)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-neutral-600">
                      TVA {Math.round(f.taux_tva * 100)} %
                    </td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      {eur(f.montant_tva)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-neutral-900">
                    <td className="py-2 font-semibold">Total TTC</td>
                    <td className="py-2 text-right font-mono text-base font-medium tabular-nums">
                      {eur(f.montant_ttc)}
                    </td>
                  </tr>
                  {f.montant_encaisse > 0 && (
                    <>
                      <tr>
                        <td className="py-1 text-neutral-600">Déjà réglé</td>
                        <td className="py-1 text-right font-mono tabular-nums">
                          − {eur(f.montant_encaisse)}
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="py-1.5 font-semibold">Reste dû</td>
                        <td className="py-1.5 text-right font-mono font-medium tabular-nums">
                          {eur(f.reste_du)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-10 border-t pt-4 text-[11px] leading-relaxed text-neutral-600">
              Règlement à 30 jours par virement — {f.emetteur.iban}. Merci de
              rappeler la référence{" "}
              <span className="font-mono">{f.numero}</span> sur votre virement.
              <br />
              <span className="text-neutral-500">{f.regle_arrondi}.</span>
              <br />
              Passé l&apos;échéance : pénalités au taux directeur de la BCE
              majoré de 10 points et indemnité forfaitaire de recouvrement de 40
              € (art. L441-10 du code de commerce). Pas d&apos;escompte pour
              paiement anticipé.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

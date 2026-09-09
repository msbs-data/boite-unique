/**
 * Client API pour communiquer avec le backend FastAPI La Boîte Unique.
 */

function getApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/v1";
  }
  if (process.env.BACKEND_INTERNAL_URL) {
    return `${process.env.BACKEND_INTERNAL_URL}/api/v1`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1";
}

const API_BASE = getApiBase();

export interface StatsCompteurs {
  pieces: number;
  lues: number;
  a_verifier: number;
  exportees: number;
  structurees: number;
  quarantaine: number;
  dossiers: number;
  restants: number;
}

export interface Dossier {
  id: number;
  code: string;
  raison_sociale: string;
  alias: string;
  actif: boolean;
}

export interface Piece {
  id: number;
  dossier_id: number;
  dossier_code?: string;
  raison_sociale?: string;
  nom_fichier: string;
  empreinte: string;
  recue_le: string;
  source: string;
  type: string;
  etat: "lue" | "a_verifier" | "exportee" | string;
  expediteur?: string;
  alias_vise?: string;
  entete_retenu?: string;
  chemin_image?: string;
  numero?: string;
  date_facture?: string;
  fournisseur?: string;
  tva_intracom?: string;
  siren?: string;
  montant_ht?: string;
  montant_tva?: string;
  montant_ttc?: string;
  devise?: string;
  profil?: string;
  confiance?: number;
  methode?: string;
  validee_par?: string;
}

export interface Quarantaine {
  id: number;
  nom_fichier: string;
  recue_le: string;
  expediteur?: string;
  adresses_examinees: string;
  motif: string;
}

export interface LigneSage {
  journal: string;
  date_ecriture: string;
  compte: string;
  libelle: string;
  debit?: number;
  credit?: number;
  numero_piece: string;
  image: string;
}

export interface ExportHistorique {
  id: number;
  fait_le: string;
  fichier: string;
  nb_pieces: number;
  pieces: number[];
}

export interface SageApercu {
  nb_pieces: number;
  total_debit: number;
  total_credit: number;
  equilibre: boolean;
  lignes: LigneSage[];
  csv_apercu: string;
  derniers_exports: ExportHistorique[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const err = await response.json();
      errorDetail = err.detail || errorDetail;
    } catch {
      // Keep status text
    }
    throw new Error(`Erreur API (${response.status}): ${errorDetail}`);
  }

  return response.json() as Promise<T>;
}

// ─────────────────────────── Facturation client ───────────────────────────

export interface SemaineTemps {
  semaine: string;
  du: string;
  heures: number;
  montant: number;
}

export interface LigneSynthese {
  dossier_code: string;
  raison_sociale: string;
  heures: number;
  taux_horaire: number;
  montant_ht: number;
  heures_a_facturer: number;
  montant_a_facturer: number;
  jours: number;
  semaines: SemaineTemps[];
  facture_numero?: string | null;
  facture_etat?: string | null;
}

export interface SyntheseFacturation {
  periode: string;
  lignes: LigneSynthese[];
  total_heures: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  total_a_facturer: number;
  dossiers_pointes: number;
}

export interface FactureHonoraires {
  id: number;
  numero: string;
  dossier_code: string;
  raison_sociale: string;
  alias?: string | null;
  periode: string;
  emise_le: string;
  echeance_le: string;
  heures: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  etat:
    "brouillon" | "envoyee" | "encaissee" | "partielle" | "impayee" | string;
  envoyee_le?: string | null;
  envoyee_a?: string | null;
  relances: number;
  montant_encaisse: number;
  reste_du: number;
  jours_retard: number;
}

export interface FactureDetail {
  numero: string;
  periode: string;
  emise_le: string;
  echeance_le: string;
  etat: string;
  relances: number;
  client: { code: string; raison_sociale: string; alias: string };
  lignes: {
    jour: string;
    libelle: string;
    heures: number;
    taux_horaire: number;
    montant: number;
  }[];
  heures: number;
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  montant_encaisse: number;
  reste_du: number;
}

export interface LigneReleve {
  id: number;
  jour: string;
  libelle: string;
  montant: number;
  reference?: string | null;
  rapprochement: "exact" | "approchant" | "aucun" | string;
  facture_numero?: string | null;
}

export interface SaisieTemps {
  id: number;
  dossier_code: string;
  raison_sociale: string;
  jour: string;
  heures: number;
  taux_horaire: number;
  montant: number;
  libelle?: string | null;
  saisi_par?: string | null;
  facturee: boolean;
  facture_id?: number | null;
}

export interface VariablePaie {
  id: number;
  salarie: string;
  code: string;
  libelle: string;
  valeur: number;
  unite: string;
  confiance: number;
  extrait?: string | null;
  alerte?: string | null;
  validee: boolean;
}

export interface MessagePaie {
  id: number;
  canal: "whatsapp" | "gmail" | "telegram" | string;
  canal_libelle: string;
  expediteur: string;
  recu_le: string;
  contenu: string;
  periode: string;
  etat: "a_lire" | "propose" | "valide" | "ecarte" | string;
  confiance?: number | null;
  remarque?: string | null;
  dossier_code?: string | null;
  raison_sociale?: string | null;
  variables: VariablePaie[];
}

export interface ExportPaie {
  periode: string;
  lignes: {
    dossier: string;
    salarie: string;
    code: string;
    valeur: number;
    unite: string;
  }[];
  nb: number;
  fichier: string;
  contenu: string;
  avertissement?: string | null;
}

export const api = {
  // Stats
  getStats: () => request<StatsCompteurs>("/stats"),

  // Dossiers
  getDossiers: () => request<Dossier[]>("/dossiers"),
  createDossier: (data: {
    code: string;
    raison_sociale: string;
    alias: string;
  }) =>
    request<Dossier>("/dossiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  // Pièces
  getPieces: (params?: { q?: string; etat?: string; dossier?: string }) => {
    const query = new URLSearchParams();
    if (params?.q) query.append("q", params.q);
    if (params?.etat) query.append("etat", params.etat);
    if (params?.dossier) query.append("dossier", params.dossier);
    const queryString = query.toString();
    return request<Piece[]>(`/pieces${queryString ? `?${queryString}` : ""}`);
  },
  getPiece: (id: number) => request<Piece>(`/pieces/${id}`),
  validerPiece: (id: number) =>
    request<{ message: string; piece_id: number }>(`/pieces/${id}/valider`, {
      method: "POST",
    }),
  getPieceFileUrl: (id: number) => `${API_BASE}/pieces/${id}/fichier`,

  // Actions
  recevoirEmails: (tout = false) =>
    request<{ message: string; traites: number; details: unknown[] }>(
      `/actions/recevoir?tout=${tout}`,
      {
        method: "POST",
      },
    ),
  deposerFichier: (formData: FormData) =>
    request<{ message: string; resultat: Record<string, unknown> }>(
      "/actions/deposer",
      {
        method: "POST",
        body: formData,
      },
    ),
  reinitialiser: () =>
    request<{ message: string }>("/actions/reinitialiser", { method: "POST" }),

  // Quarantaine
  getQuarantaine: () => request<Quarantaine[]>("/quarantaine"),
  viderQuarantaine: () =>
    request<{ message: string }>("/quarantaine", { method: "DELETE" }),

  // Facturation client
  getSynthese: (periode?: string) =>
    request<SyntheseFacturation>(
      `/facturation/synthese${periode ? `?periode=${periode}` : ""}`,
    ),
  getTemps: (params?: { periode?: string; dossier?: string }) => {
    const q = new URLSearchParams();
    if (params?.periode) q.append("periode", params.periode);
    if (params?.dossier) q.append("dossier", params.dossier);
    const qs = q.toString();
    return request<SaisieTemps[]>(`/facturation/temps${qs ? `?${qs}` : ""}`);
  },
  saisirTemps: (data: {
    dossier_code: string;
    jour: string;
    heures: number;
    taux_horaire?: number;
    libelle?: string;
    saisi_par?: string;
  }) =>
    request<{ id: number }>("/facturation/temps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  modifierTemps: (
    id: number,
    data: {
      heures?: number;
      taux_horaire?: number;
      jour?: string;
      libelle?: string;
    },
  ) =>
    request<{
      id: number;
      heures: number;
      taux_horaire: number;
      jour: string;
      libelle?: string;
      montant: number;
    }>(`/facturation/temps/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  appliquerTaux: (
    dossier_code: string,
    taux_horaire: number,
    periode?: string,
  ) =>
    request<{ dossier: string; lignes: number; message: string }>(
      "/facturation/taux",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossier_code,
          taux_horaire,
          periode: periode ?? null,
        }),
      },
    ),
  attribuerLigne: (ligneId: number, facture_id: number | null) =>
    request<{ ligne: number; facture: number | null; message: string }>(
      `/facturation/releve/${ligneId}/attribuer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facture_id }),
      },
    ),
  supprimerTemps: (id: number) =>
    request<{ supprimee: number }>(`/facturation/temps/${id}`, {
      method: "DELETE",
    }),
  genererFactures: (periode?: string, dossiers?: string[]) =>
    request<{
      periode: string;
      creees: unknown[];
      ignorees: unknown[];
      message: string;
    }>("/facturation/generer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periode: periode ?? null,
        dossiers: dossiers ?? null,
      }),
    }),
  getFactures: (params?: { periode?: string; etat?: string }) => {
    const q = new URLSearchParams();
    if (params?.periode) q.append("periode", params.periode);
    if (params?.etat) q.append("etat", params.etat);
    const qs = q.toString();
    return request<FactureHonoraires[]>(
      `/facturation/factures${qs ? `?${qs}` : ""}`,
    );
  },
  getFactureDetail: (id: number) =>
    request<FactureDetail>(`/facturation/factures/${id}/detail`),
  envoyerFactures: (ids: number[]) =>
    request<{ envoyees: unknown[]; simule: boolean; message: string }>(
      "/facturation/factures/envoyer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      },
    ),
  relancerFactures: (ids: number[]) =>
    request<{ relancees: unknown[]; simule: boolean; message: string }>(
      "/facturation/factures/relancer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      },
    ),
  getReleve: () => request<LigneReleve[]>("/facturation/releve"),
  simulerReleve: () =>
    request<{ message: string; lignes: number }>(
      "/facturation/releve/simuler",
      { method: "POST" },
    ),
  rapprocher: () =>
    request<{ exacts: number; approchants: number; message: string }>(
      "/facturation/rapprocher",
      {
        method: "POST",
      },
    ),

  // Paie — collecte des variables
  getMessagesPaie: (params?: { periode?: string; etat?: string }) => {
    const q = new URLSearchParams();
    if (params?.periode) q.append("periode", params.periode);
    if (params?.etat) q.append("etat", params.etat);
    const qs = q.toString();
    return request<MessagePaie[]>(`/paie/messages${qs ? `?${qs}` : ""}`);
  },
  recevoirMessagePaie: (data: {
    canal: string;
    expediteur: string;
    contenu: string;
    dossier_code?: string;
    periode?: string;
  }) =>
    request<{ id: number; variables: number; message: string }>(
      "/paie/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),
  corrigerVariablePaie: (id: number, valeur: number) =>
    request<{ id: number; valeur: number }>(`/paie/variables/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valeur }),
    }),
  validerMessagePaie: (id: number) =>
    request<{ message: string }>(`/paie/messages/${id}/valider`, {
      method: "POST",
    }),
  ecarterMessagePaie: (id: number) =>
    request<{ message: string }>(`/paie/messages/${id}/ecarter`, {
      method: "POST",
    }),
  getExportPaie: (periode?: string) =>
    request<ExportPaie>(`/paie/export${periode ? `?periode=${periode}` : ""}`),

  // Sage exports
  getSageApercu: () => request<SageApercu>("/exports/apercu"),
  genererExportSage: () =>
    request<ExportHistorique>("/exports/generer", { method: "POST" }),
  getExports: () => request<ExportHistorique[]>("/exports"),
  getExportDownloadUrl: (nomFichier: string) =>
    `${API_BASE}/exports/${encodeURIComponent(nomFichier)}/telecharger`,
};

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

export const api = {
  // Stats
  getStats: () => request<StatsCompteurs>("/stats"),

  // Dossiers
  getDossiers: () => request<Dossier[]>("/dossiers"),
  createDossier: (data: { code: string; raison_sociale: string; alias: string }) =>
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
    request<{ message: string; traites: number; details: unknown[] }>(`/actions/recevoir?tout=${tout}`, {
      method: "POST",
    }),
  deposerFichier: (formData: FormData) =>
    request<{ message: string; resultat: Record<string, unknown> }>("/actions/deposer", {
      method: "POST",
      body: formData,
    }),
  reinitialiser: () => request<{ message: string }>("/actions/reinitialiser", { method: "POST" }),

  // Quarantaine
  getQuarantaine: () => request<Quarantaine[]>("/quarantaine"),
  viderQuarantaine: () => request<{ message: string }>("/quarantaine", { method: "DELETE" }),

  // Sage exports
  getSageApercu: () => request<SageApercu>("/exports/apercu"),
  genererExportSage: () => request<ExportHistorique>("/exports/generer", { method: "POST" }),
  getExports: () => request<ExportHistorique[]>("/exports"),
  getExportDownloadUrl: (nomFichier: string) => `${API_BASE}/exports/${encodeURIComponent(nomFichier)}/telecharger`,
};

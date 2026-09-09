import { create } from "zustand";

interface BoiteState {
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterDossier: string;
  setFilterDossier: (dossier: string) => void;
  filterEtat: string;
  setFilterEtat: (etat: string) => void;
}

export const useBoiteStore = create<BoiteState>((set) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  searchTerm: "",
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  filterDossier: "all",
  setFilterDossier: (filterDossier) => set({ filterDossier }),
  filterEtat: "all",
  setFilterEtat: (filterEtat) => set({ filterEtat }),
}));

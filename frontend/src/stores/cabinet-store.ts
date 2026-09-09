import { toast } from "sonner";
import { create } from "zustand";

import { api, type StatsCompteurs } from "@/lib/api-client";

interface CabinetState {
  stats: StatsCompteurs | null;
  isLoadingStats: boolean;
  isReceiving: boolean;
  isResetting: boolean;
  lastUpdated: number;

  fetchStats: () => Promise<void>;
  recevoirEmails: (tout?: boolean) => Promise<number>;
  reinitialiser: () => Promise<void>;
}

export const useCabinetStore = create<CabinetState>((set, get) => ({
  stats: null,
  isLoadingStats: false,
  isReceiving: false,
  isResetting: false,
  lastUpdated: Date.now(),

  fetchStats: async () => {
    try {
      set({ isLoadingStats: true });
      const data = await api.getStats();
      set({ stats: data, isLoadingStats: false, lastUpdated: Date.now() });
    } catch (err: any) {
      set({ isLoadingStats: false });
      console.error("Erreur lors de la récupération des stats:", err);
    }
  },

  recevoirEmails: async (tout = false) => {
    try {
      set({ isReceiving: true });
      const res = await api.recevoirEmails(tout);
      if (res.traites > 0) {
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
      await get().fetchStats();
      set({ isReceiving: false });
      return res.traites;
    } catch (err: any) {
      set({ isReceiving: false });
      toast.error(err.message || "Erreur lors de la relève des emails.");
      return 0;
    }
  },

  reinitialiser: async () => {
    try {
      set({ isResetting: true });
      const res = await api.reinitialiser();
      toast.success(res.message || "Données réinitialisées.");
      await get().fetchStats();
      set({ isResetting: false });
    } catch (err: any) {
      set({ isResetting: false });
      toast.error(err.message || "Erreur lors de la réinitialisation.");
    }
  },
}));

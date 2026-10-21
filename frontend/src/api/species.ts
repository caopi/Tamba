import { api } from "./client";
import type { Dex, FishSpecies, FishingSpot, Stats } from "../types";

export const speciesApi = {
  /** Catálogo ativo. */
  list: () => api<FishSpecies[]>("/species"),
};

export const dexApi = {
  /** Dex do usuário logado: { total, captured, species[] }. */
  get: () => api<Dex>("/dex"),
  stats: () => api<Stats>("/dex/stats"),
};

export const spotsApi = {
  /** Só os ativos (o admin usa adminApi.listSpots, com os desativados). */
  list: () => api<FishingSpot[]>("/spots"),
};

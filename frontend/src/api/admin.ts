import { api } from "./client";
import type { CatchReports, FishSpecies, FishingSpot, PublicProfile, SpeciesInput, SpotInput } from "../types";

/**
 * Ações de admin. Não há área de admin no app: estas chamadas aparecem dentro
 * das telas normais, só para quem tem papel admin. A API recusa (403) para os
 * demais, independentemente do que a tela mostra.
 */
const json = (metodo: string, corpo: unknown) => ({ method: metodo, body: JSON.stringify(corpo) });

export const adminApi = {
  // UC011 — moderação de captura
  catchReports: (catchId: string) => api<CatchReports>(`/admin/catches/${catchId}/reports`),
  /** Oculta ou reexibe a captura e marca as denúncias pendentes como analisadas. */
  review: (catchId: string, hide: boolean) =>
    api<void>(`/admin/catches/${catchId}/review`, json("POST", { hide })),

  // UC002 (lado admin) — desativar/reativar conta
  setUserActive: (userId: string, isActive: boolean) =>
    api<PublicProfile>(`/admin/users/${userId}/active`, json("PATCH", { isActive })),

  // UC010 — catálogo de espécies
  createSpecies: (dados: SpeciesInput) => api<FishSpecies>("/admin/species", json("POST", dados)),
  updateSpecies: (id: string, dados: SpeciesInput) =>
    api<FishSpecies>(`/admin/species/${id}`, json("PUT", dados)),
  setSpeciesActive: (id: string, isActive: boolean) =>
    api<FishSpecies>(`/admin/species/${id}/active`, json("PATCH", { isActive })),

  // UC012 — pesqueiros (acréscimo, fora do documento; ver DIVERGENCIAS.md)
  /** Inclui os desativados. */
  listSpots: () => api<FishingSpot[]>("/admin/spots"),
  createSpot: (dados: SpotInput) => api<FishingSpot>("/admin/spots", json("POST", dados)),
  updateSpot: (id: string, dados: SpotInput) => api<FishingSpot>(`/admin/spots/${id}`, json("PUT", dados)),
  setSpotActive: (id: string, isActive: boolean) =>
    api<FishingSpot>(`/admin/spots/${id}/active`, json("PATCH", { isActive })),
};

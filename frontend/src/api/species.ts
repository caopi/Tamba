import { api } from "./client";
import type { FishSpecies, FishingSpot } from "../types";

export const speciesApi = {
  list: () => api<FishSpecies[]>("/species"),
};

export const spotsApi = {
  list: () => api<FishingSpot[]>("/spots"),
};

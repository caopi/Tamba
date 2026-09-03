// Tipos espelhando o que a API devolve

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface FishSpecies {
  id: string;
  name: string;
  scientificName: string;
  habitat: string;
  imageUrl: string | null;
  /** Iscas típicas, separadas por vírgula: "massa, milho, minhoca". */
  recommendedBaits: string | null;
}

export interface FishingSpot {
  id: string;
  name: string;
  location: string;
  googlePlaceId: string | null;
}

export interface Catch {
  id: string;
  userId: string;
  speciesId: string;
  spotId: string | null;
  /** Peso em kg. */
  weight: number;
  /** Comprimento em cm. */
  length: number;
  photoUrl: string | null;
  caughtAt: string;
  createdAt: string;
  // A API sempre devolve as relações junto (include no controller).
  species: FishSpecies;
  spot: FishingSpot | null;
}

/** Corpo aceito por POST/PUT /catches. */
export interface CatchInput {
  speciesId: string;
  spotId?: string | null;
  weight: number;
  length: number;
  photoUrl?: string | null;
  caughtAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

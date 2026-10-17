// Tipos espelhando o que a API devolve

export type Role = "user" | "admin";
export type MeasurementUnit = "kg" | "lb";
export type Rarity = "comum" | "incomum" | "raro" | "muito_raro";

/** O próprio usuário logado (GET /auth/me). */
export interface User {
  id: string;
  name: string;
  nickname: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  /** Só preferência de exibição: a API fala sempre em kg. */
  measurementUnit: MeasurementUnit;
  shareExactLocation: boolean;
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
  rarity: Rarity;
  /** Faixa plausível, em kg e cm. null = sem faixa cadastrada. */
  minWeight: number | null;
  maxWeight: number | null;
  minLength: number | null;
  maxLength: number | null;
  curiosities: string | null;
  isActive: boolean;
}

/** Espécie como aparece na Dex do usuário (GET /dex). */
export interface DexSpecies extends FishSpecies {
  captured: boolean;
  catchCount: number;
  firstCaughtAt: string | null;
  isFavorite: boolean;
  /** Desativada do catálogo, mas o usuário já tinha pescado: fora da contagem. */
  archived: boolean;
}

export interface Dex {
  /** Espécies ativas do catálogo (o Y de "X/Y"). */
  total: number;
  /** Ativas que o usuário já capturou (o X). */
  captured: number;
  species: DexSpecies[];
}

/** GET /dex/stats. Capturas ocultas pela moderação não contam. */
export interface Stats {
  totalCatches: number;
  speciesCaptured: number;
  heaviestWeight: number | null;
  longestLength: number | null;
  lastCaughtAt: string | null;
}

export interface FishingSpot {
  id: string;
  name: string;
  location: string;
  googlePlaceId: string | null;
}

export interface CatchPhoto {
  id: string;
  url: string;
  position: number;
}

export interface Catch {
  id: string;
  userId: string;
  speciesId: string;
  spotId: string | null;
  /** Local digitado à mão. Vale enquanto o Google Places não entra. */
  spotName: string | null;
  /** Cidade/estado. Vem do pesqueiro do catálogo ou é digitada. */
  region: string | null;
  /** Peso em kg. */
  weight: number;
  /** Comprimento em cm. */
  length: number;
  /** Legado: igual a photos[0].url. */
  photoUrl: string | null;
  photos: CatchPhoto[];
  notes: string | null;
  /** Só vêm para o autor, ou se o autor compartilha a localização exata. */
  latitude?: number | null;
  longitude?: number | null;
  /** Peso/tamanho fora da faixa da espécie, confirmado pelo usuário. */
  isFlaggedForReview: boolean;
  /** Oculta pela moderação ("em análise"). Só o autor vê. */
  isHidden: boolean;
  caughtAt: string;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  species: Pick<FishSpecies, "id" | "name" | "scientificName" | "imageUrl" | "rarity">;
  spot: FishingSpot | null;
  author: { id: string; name: string; nickname: string; avatarUrl: string | null };
}

/** Corpo aceito por POST/PUT /catches. */
export interface CatchInput {
  speciesId: string;
  spotId?: string | null;
  spotName?: string | null;
  region?: string | null;
  weight: number;
  length: number;
  photoUrls: string[];
  notes?: string | null;
  caughtAt: string;
  /** Reenviar com true depois que o usuário confirma a medida fora da faixa. */
  confirmOutOfRange?: boolean;
}

/** Um campo fora da faixa, no `details` do erro OUT_OF_RANGE. */
export interface OutOfRangeDetail {
  campo: "weight" | "length";
  min: number | null;
  max: number | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SignupInput {
  name: string;
  nickname: string;
  email: string;
  password: string;
}

/** Resultado do link de confirmação, vindo na query string de /verificacao. */
export type VerificationStatus = "ok" | "expired" | "invalid";

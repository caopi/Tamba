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
  /**
   * Só preferência de exibição: a API fala sempre em kg e cm. "kg" = sistema
   * métrico (kg, cm); "lb" = imperial (libras, polegadas). Ver src/units.ts.
   */
  measurementUnit: MeasurementUnit;
  shareExactLocation: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  createdAt: string;
}

/** PATCH /users/me: tudo opcional. */
export type ProfileUpdate = Partial<
  Pick<
    User,
    | "name"
    | "nickname"
    | "avatarUrl"
    | "measurementUnit"
    | "shareExactLocation"
    | "notifyLikes"
    | "notifyComments"
    | "notifyFollows"
  >
>;

export interface FishSpecies {
  id: string;
  name: string;
  scientificName: string;
  habitat: string;
  /** Foto do repositório ou enviada pelo admin: a API já devolve a URL completa. */
  imageUrl: string | null;
  /** Autor, licença e origem da foto (null quando não há foto). */
  imageCredit: string | null;
  imageLicense: string | null;
  imageSourceUrl: string | null;
  /** Legenda opcional, nas entradas de gênero: "Na foto: Cichla piquiti...". */
  imageCaption: string | null;
  /** Reservado para um modelo 3D; sempre null por enquanto. */
  modelUrl: string | null;
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
  /** Em ordem; a primeira (posição 0) é a capa. */
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
  author: PublicUser & { isFollowedByMe: boolean };
}

/** O que os outros veem de um usuário. */
export interface PublicUser {
  id: string;
  name: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt?: string;
}

/** Pessoa na busca e nas sugestões de quem seguir. */
export interface UserCard extends PublicUser {
  followers: number;
  catchCount: number;
  lastCatchAt: string | null;
  isFollowedByMe: boolean;
}

/** GET /users/:id. */
export interface PublicProfile extends PublicUser {
  followers: number;
  following: number;
  stats: Stats;
  isFollowedByMe: boolean;
  /** Só vem para admin (que vê também conta desativada). */
  isActive?: boolean;
  role?: Role;
}

/** GET /admin/catches/:id/reports. */
export interface CatchReports {
  catchId: string;
  isHidden: boolean;
  pendingCount: number;
  reports: {
    id: string;
    reason: string;
    status: "pendente" | "analisado";
    createdAt: string;
    reporter: { id: string; nickname: string };
  }[];
}

/** Corpo do cadastro/edição de espécie pelo admin (kg e cm). */
export interface SpeciesInput {
  name: string;
  scientificName: string;
  habitat: string;
  imageUrl: string | null;
  imageCredit: string | null;
  imageLicense: string | null;
  imageSourceUrl: string | null;
  imageCaption: string | null;
  recommendedBaits: string | null;
  rarity: Rarity;
  minWeight: number | null;
  maxWeight: number | null;
  minLength: number | null;
  maxLength: number | null;
  curiosities: string | null;
}

/** `reported`: só admin — capturas com denúncia pendente. */
export type FeedScope = "following" | "all" | "reported";
export type FeedOrder = "recent" | "engagement";

export interface FeedPage {
  items: Catch[];
  /** Repassar como `cursor` para a próxima página; null = acabou. */
  nextCursor: string | null;
}

/** UC009, REQ-43: alguém curtiu, comentou ou começou a seguir. */
export type NotificationType = "like" | "comment" | "follow";

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** Captura curtida/comentada; null no follow (aí o destino é o perfil do ator). */
  catchId: string | null;
  speciesName: string | null;
  /** A captura foi ocultada por denúncias depois do aviso (a dona ainda abre). */
  catchIsHidden: boolean;
  isRead: boolean;
  createdAt: string;
  actor: PublicUser;
}

export interface NotificationPage {
  items: AppNotification[];
  unreadCount: number;
  nextCursor: string | null;
}

export interface Comment {
  id: string;
  catchId: string;
  body: string;
  createdAt: string;
  author: PublicUser;
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
  latitude?: number | null;
  longitude?: number | null;
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

/** POST /auth/signup. `token` é null quando o backend exige confirmação de e-mail. */
export interface SignupResponse {
  user: User;
  token: string | null;
  requiresVerification: boolean;
  message: string;
}

export interface SignupInput {
  name: string;
  nickname: string;
  email: string;
  password: string;
}

/** Resultado do link de confirmação, vindo na query string de /verificacao. */
export type VerificationStatus = "ok" | "expired" | "invalid";

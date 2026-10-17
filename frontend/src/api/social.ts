import { api } from "./client";
import type {
  Catch,
  Comment,
  FeedOrder,
  FeedPage,
  FeedScope,
  PublicProfile,
  PublicUser,
  UserCard,
} from "../types";

const json = (corpo: unknown) => ({ method: "POST", body: JSON.stringify(corpo) });

export const feedApi = {
  /** REQ-26/28/35: padrão "Seguindo" e cronológico. */
  get: (params: { scope: FeedScope; order: FeedOrder; cursor?: string | null; limit?: number }) => {
    const busca = new URLSearchParams({ scope: params.scope, order: params.order });
    if (params.cursor) busca.set("cursor", params.cursor);
    if (params.limit) busca.set("limit", String(params.limit));
    return api<FeedPage>(`/feed?${busca}`);
  },
};

export const postApi = {
  get: (id: string) => api<Catch>(`/catches/${id}`),

  /** Idempotentes: devolvem o estado final. */
  like: (id: string) => api<{ liked: boolean; likeCount: number }>(`/catches/${id}/like`, { method: "POST" }),
  unlike: (id: string) =>
    api<{ liked: boolean; likeCount: number }>(`/catches/${id}/like`, { method: "DELETE" }),

  comments: (id: string) => api<Comment[]>(`/catches/${id}/comments`),
  addComment: (id: string, body: string) => api<Comment>(`/catches/${id}/comments`, json({ body })),
  deleteComment: (commentId: string) => api<void>(`/comments/${commentId}`, { method: "DELETE" }),

  report: (id: string, reason: string) =>
    api<{ message: string }>(`/catches/${id}/reports`, json({ reason })),
};

export const usersApi = {
  profile: (id: string) => api<PublicProfile>(`/users/${id}`),
  catches: (id: string) => api<Catch[]>(`/users/${id}/catches`),
  followers: (id: string) => api<PublicUser[]>(`/users/${id}/followers`),
  following: (id: string) => api<PublicUser[]>(`/users/${id}/following`),

  /** Idempotentes: devolvem `{ following, followers }` do usuário seguido. */
  follow: (id: string) =>
    api<{ following: boolean; followers: number }>(`/users/${id}/follow`, { method: "POST" }),
  unfollow: (id: string) =>
    api<{ following: boolean; followers: number }>(`/users/${id}/follow`, { method: "DELETE" }),

  /** REQ-41/42: nome ou apelido, mínimo de 2 letras. */
  search: (q: string) => api<UserCard[]>(`/users/search?q=${encodeURIComponent(q)}`),
  /** REQ-36: quem seguir. */
  suggestions: () => api<UserCard[]>("/users/suggestions"),
};

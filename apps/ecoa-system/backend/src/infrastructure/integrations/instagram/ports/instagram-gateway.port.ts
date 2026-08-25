export const INSTAGRAM_GATEWAY = Symbol('INSTAGRAM_GATEWAY');

export interface IgTokenResult {
  igUserId: string;
  username: string;
  accessToken: string;
  /** null when the API does not return an expiry (treat as long-lived ~60 days). */
  expiresAt: Date | null;
}

export interface IgRefreshResult {
  accessToken: string;
  expiresAt: Date | null;
}

export interface IgMedia {
  igMediaId: string;
  permalink: string;
  mediaType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
}

export interface IgMediaInsights {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saved: number;
  sharesCount: number;
}

export interface IgMention {
  /** username of the account that mentioned/reshared the tenant's content */
  sourceUsername: string;
  /** the tenant media that was reshared, when the API exposes it */
  mediaId: string | null;
  permalink: string | null;
  mentionedAt: Date;
}

/**
 * Boundary to the Instagram Graph API. The concrete adapter lives in infrastructure and is
 * the ONLY place that talks to Meta — the token never leaves the server. Every method takes
 * the (already decrypted) access token of the tenant it acts on behalf of.
 *
 * NOTE: exact scope/field/webhook names must be confirmed against Meta's current docs before
 * relying on them in production (see ECOA_SPEC §"LEIA ANTES DE CODIFICAR").
 */
export interface InstagramGatewayPort {
  /** Builds the Meta OAuth authorization URL for the given anti-CSRF state. */
  buildOAuthUrl(state: string): string;

  /** Exchanges the OAuth `code` for a long-lived token + the connected account identity. */
  exchangeCodeForToken(code: string): Promise<IgTokenResult>;

  /** Refreshes a long-lived token before it expires. */
  refreshLongLivedToken(currentToken: string): Promise<IgRefreshResult>;

  /** Pulls the account's recent media. */
  fetchRecentMedia(igUserId: string, accessToken: string, limit?: number): Promise<IgMedia[]>;

  /** Reads insight metrics for a single media. */
  fetchMediaInsights(igMediaId: string, accessToken: string): Promise<IgMediaInsights>;

  /** Resolves a public @handle to its ig_user_id (business discovery), or null if not found. */
  resolveHandle(handle: string, accessToken: string): Promise<string | null>;

  /** Safety-net read of the mentions edge (used by reconcile-mentions). */
  fetchMentions(igUserId: string, accessToken: string): Promise<IgMention[]>;
}

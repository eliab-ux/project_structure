// Shared API types. Mirror the backend Response DTOs — never include sensitive fields.

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Connection {
  connected: boolean;
  igUserId: string | null;
  username: string | null;
  status: 'connected' | 'expired' | 'revoked' | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
}

export interface OAuthUrl {
  url: string;
  state: string;
}

export interface WatchedAccount {
  id: string;
  handle: string;
  igUserId: string | null;
  resolved: boolean;
  active: boolean;
  addedAt: string;
}

export interface Media {
  id: string;
  igMediaId: string;
  permalink: string;
  mediaType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface InsightSnapshot {
  capturedAt: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saved: number;
  sharesCount: number;
}

// Mirrors the backend DetectionType VO. No story_mention: Meta does not expose story
// reshares on the Instagram API with Facebook Login.
export type DetectionType = 'caption_mention' | 'comment_mention' | 'tag';

export interface Detection {
  id: string;
  sourceUsername: string;
  detectionType: DetectionType;
  ownMediaId: string | null;
  watchedAccountId: string | null;
  highlighted: boolean;
  permalink: string | null;
  detectedAt: string;
  seen: boolean;
}

export interface DetectionSummary {
  total: number;
  last7Days: number;
  last30Days: number;
  byAccount: Array<{ sourceUsername: string; count: number }>;
}

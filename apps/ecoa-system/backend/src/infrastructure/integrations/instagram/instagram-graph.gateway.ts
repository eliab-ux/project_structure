import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { NoLinkedInstagramAccountException } from '../../../contexts/connection/domain/exceptions/no-linked-instagram-account.exception';
import {
  IgMedia,
  IgMediaInsights,
  IgMention,
  IgRefreshResult,
  IgTokenResult,
  InstagramGatewayPort,
} from './ports/instagram-gateway.port';

/**
 * Concrete adapter for the Instagram Graph API (via the Facebook Login/Graph endpoints).
 * This is the ONLY place that talks to Meta — the token never leaves the server.
 *
 * ⚠️ ECOA_SPEC §"LEIA ANTES DE CODIFICAR": Meta changes scopes, webhook fields and App Review
 * rules frequently. The endpoints/fields/scopes below target Graph API {META_GRAPH_API_VERSION}
 * and MUST be confirmed against Meta's current docs before relying on them in production.
 * They are intentionally isolated behind InstagramGatewayPort so adjusting them requires no
 * change outside this file.
 */
@Injectable()
export class InstagramGraphGateway implements InstagramGatewayPort {
  private readonly logger = new Logger(InstagramGraphGateway.name);

  // Confirm the exact scope names against the live Meta docs before production use.
  //
  // Scopes requested at OAuth consent. Every scope here MUST map to a call this file actually
  // makes — App Review rejects permissions the app cannot demonstrate, and it has already cost
  // us two rounds:
  //   - pages_read_engagement: removed after round 1. The app never reads Page posts/engagement.
  //   - business_management:   removed after round 2. The justification claimed Business Manager
  //     asset access, but the only calls made are /me/accounts and
  //     /{page-id}?fields=instagram_business_account — both covered by pages_show_list.
  //
  // Kept, with the call that needs each one:
  //   instagram_basic            → /{ig-user-id}/media, /{ig-media-id}, business_discovery
  //   instagram_manage_insights  → /{ig-media-id}/insights, business_discovery
  //   pages_show_list            → /me/accounts (locate the Page linked to the IG account)
  //   instagram_manage_comments  → `mentions` webhook + /{ig-user-id}/tags (the Detections
  //                                feature). Without it the webhook delivers nothing in Live.
  private readonly scopes = [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_show_list',
    'instagram_manage_comments',
  ];

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  buildOAuthUrl(state: string): string {
    const version = this.version();
    const params = new URLSearchParams({
      client_id: this.require('META_APP_ID'),
      redirect_uri: this.require('META_OAUTH_REDIRECT_URI'),
      state,
      response_type: 'code',
      scope: this.scopes.join(','),
    });
    return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<IgTokenResult> {
    const appId = this.require('META_APP_ID');
    const appSecret = this.require('META_APP_SECRET');
    const redirectUri = this.require('META_OAUTH_REDIRECT_URI');

    // 1. code → short-lived user access token
    const shortLived = await this.graphGet<{ access_token: string }>('/oauth/access_token', {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    // 2. short-lived → long-lived user token (~60 days)
    const longLived = await this.graphGet<{ access_token: string; expires_in?: number }>(
      '/oauth/access_token',
      {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLived.access_token,
      },
    );

    const accessToken = longLived.access_token;
    const expiresAt = this.expiryFromSeconds(longLived.expires_in);

    // 3. resolve the connected IG business account (id + username)
    const { igUserId, username } = await this.resolveConnectedIgAccount(accessToken);

    return { igUserId, username, accessToken, expiresAt };
  }

  async refreshLongLivedToken(currentToken: string): Promise<IgRefreshResult> {
    // Re-exchanging a still-valid long-lived token extends it (documented pattern).
    const refreshed = await this.graphGet<{ access_token: string; expires_in?: number }>(
      '/oauth/access_token',
      {
        grant_type: 'fb_exchange_token',
        client_id: this.require('META_APP_ID'),
        client_secret: this.require('META_APP_SECRET'),
        fb_exchange_token: currentToken,
      },
    );
    return {
      accessToken: refreshed.access_token,
      expiresAt: this.expiryFromSeconds(refreshed.expires_in),
    };
  }

  async fetchRecentMedia(igUserId: string, accessToken: string, limit = 25): Promise<IgMedia[]> {
    const data = await this.graphGet<{ data?: RawMedia[] }>(`/${igUserId}/media`, {
      fields: 'id,permalink,media_type,caption,thumbnail_url,media_url,timestamp',
      limit,
      access_token: accessToken,
    });
    return (data.data ?? []).map((m) => ({
      igMediaId: m.id,
      permalink: m.permalink ?? '',
      mediaType: m.media_type ?? 'UNKNOWN',
      caption: m.caption ?? null,
      thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
      publishedAt: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
  }

  async fetchMediaInsights(igMediaId: string, accessToken: string): Promise<IgMediaInsights> {
    // like_count / comments_count come from the media node itself.
    const node = await this.graphGet<{ like_count?: number; comments_count?: number }>(
      `/${igMediaId}`,
      { fields: 'like_count,comments_count', access_token: accessToken },
    );

    // reach/saved/shares come from the insights edge (instagram_manage_insights).
    // NOTE: `impressions` was dropped — Meta deprecated it for media insights on newer API
    // versions, and requesting a single unsupported metric fails the WHOLE batch call (which
    // zeroed every metric). We fetch the batch first and, if it fails, fall back to per-metric
    // requests so one unsupported metric never zeroes out the others.
    const insightValues = await this.fetchInsightMetrics(igMediaId, accessToken, [
      'reach',
      'saved',
      'shares',
    ]);

    return {
      reach: insightValues.reach ?? 0,
      impressions: insightValues.impressions ?? 0,
      likes: node.like_count ?? 0,
      comments: node.comments_count ?? 0,
      saved: insightValues.saved ?? 0,
      sharesCount: insightValues.shares ?? 0,
    };
  }

  /** Fetches media insight metrics resiliently: one unsupported metric never fails the rest. */
  private async fetchInsightMetrics(
    igMediaId: string,
    accessToken: string,
    metrics: string[],
  ): Promise<Record<string, number>> {
    const request = async (list: string[]): Promise<Record<string, number>> => {
      const insights = await this.graphGet<{ data?: RawInsight[] }>(`/${igMediaId}/insights`, {
        metric: list.join(','),
        access_token: accessToken,
      });
      return this.flattenInsights(insights.data ?? []);
    };

    try {
      return await request(metrics);
    } catch (error) {
      this.logger.warn(`Batch insights failed for media ${igMediaId}; retrying per metric`, {
        reason: (error as Error)?.message,
      });
      const out: Record<string, number> = {};
      for (const metric of metrics) {
        try {
          Object.assign(out, await request([metric]));
        } catch (err) {
          this.logger.warn(`Insight metric "${metric}" unavailable for media ${igMediaId}`, {
            reason: (err as Error)?.message,
          });
        }
      }
      return out;
    }
  }

  async resolveHandle(handle: string, accessToken: string): Promise<string | null> {
    // Business Discovery is scoped to the caller's own IG business account, so we first
    // resolve the caller's ig_user_id, then look the target handle up through it.
    try {
      const { igUserId } = await this.resolveConnectedIgAccount(accessToken);
      const data = await this.graphGet<{
        business_discovery?: { id?: string };
      }>(`/${igUserId}`, {
        fields: `business_discovery.username(${handle}){id}`,
        access_token: accessToken,
      });
      return data.business_discovery?.id ?? null;
    } catch (error) {
      this.logger.warn(`Could not resolve handle @${handle}`, {
        reason: (error as Error)?.message,
      });
      return null;
    }
  }

  async fetchMentions(igUserId: string, accessToken: string): Promise<IgMention[]> {
    // The /tags edge lists media where the account is tagged — the safety-net read used by
    // reconcile-mentions when a webhook delivery may have been lost.
    const data = await this.graphGet<{ data?: RawTag[] }>(`/${igUserId}/tags`, {
      fields: 'id,permalink,username,timestamp',
      access_token: accessToken,
    });
    return (data.data ?? []).map((t) => ({
      sourceUsername: t.username ?? 'unknown',
      mediaId: t.id ?? null,
      permalink: t.permalink ?? null,
      mentionedAt: t.timestamp ? new Date(t.timestamp) : new Date(),
    }));
  }

  // ---- internals -------------------------------------------------------------------------

  /** Finds the IG business account linked to the token's first eligible Facebook Page. */
  private async resolveConnectedIgAccount(
    accessToken: string,
  ): Promise<{ igUserId: string; username: string }> {
    const pages = await this.graphGet<{ data?: Array<{ id: string }> }>('/me/accounts', {
      fields: 'id',
      access_token: accessToken,
    });

    const candidates: Array<{ igUserId: string; username: string }> = [];
    for (const page of pages.data ?? []) {
      const detail = await this.graphGet<{
        instagram_business_account?: { id: string; username?: string };
      }>(`/${page.id}`, {
        fields: 'instagram_business_account{id,username}',
        access_token: accessToken,
      });
      const iga = detail.instagram_business_account;
      if (iga?.id) {
        candidates.push({ igUserId: iga.id, username: iga.username ?? '' });
      }
    }

    if (candidates.length === 0) {
      // Not an internal error: the user simply has no eligible account (→ 400, not 500).
      throw new NoLinkedInstagramAccountException();
    }

    // Several eligible accounts is ambiguous — we take the first and say so, so a wrong pick is
    // diagnosable instead of silent. Letting the user choose is tracked separately.
    if (candidates.length > 1) {
      this.logger.warn(
        `Meta user manages ${candidates.length} Pages with a linked Instagram account; connecting the first one`,
      );
    }
    return candidates[0];
  }

  private flattenInsights(data: RawInsight[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const metric of data) {
      const value = metric.values?.[0]?.value;
      if (typeof value === 'number') {
        out[metric.name] = value;
      }
    }
    return out;
  }

  private async graphGet<T>(path: string, params: Record<string, unknown>): Promise<T> {
    const url = `https://graph.facebook.com/${this.version()}${path}`;
    const response = await firstValueFrom(this.http.get<T>(url, { params }));
    return response.data;
  }

  private version(): string {
    return this.config.get<string>('META_GRAPH_API_VERSION', 'v21.0');
  }

  private expiryFromSeconds(seconds?: number): Date | null {
    if (!seconds || seconds <= 0) {
      return null;
    }
    return new Date(Date.now() + seconds * 1000);
  }

  private require(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`${key} is required for the Instagram integration`);
    }
    return value;
  }
}

interface RawMedia {
  id: string;
  permalink?: string;
  media_type?: string;
  caption?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
}

interface RawInsight {
  name: string;
  values?: Array<{ value?: number }>;
}

interface RawTag {
  id?: string;
  permalink?: string;
  username?: string;
  timestamp?: string;
}

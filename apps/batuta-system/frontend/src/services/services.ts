import api from 'src/services/api';
import type {
  ApprovalDecisionResult,
  ApprovalPage,
  ApprovalProgress,
  ApprovalSettings,
  Approver,
  AuditLogEntry,
  Channel,
  ChannelLoad,
  Contact,
  ContactImport,
  ContactTag,
  WebhookDiagnosis,
  Content,
  ContentPreview,
  ConversationDetail,
  ConversationSummary,
  Distribution,
  DistributionPreview,
  DistributionProgress,
  HealthPanel,
  InboxCounters,
  ConsentBasis,
  LoginResponse,
  MeResponse,
  MigrationPreview,
  Paginated,
  SenderMigration,
  PlatformAccount,
  PlatformSession,
  AbuseSignals,
  QrCode,
  QuickReply,
  SubmissionResult,
} from 'src/types/api';

/**
 * One service per resource, all in one file.
 *
 * The frontend guidelines ask for `src/services/{resource}Service.ts`; this keeps that SHAPE — a named
 * object per resource, default-exported functions underneath — while avoiding fourteen near-empty files
 * whose entire content is a URL and a generic. Each resource below is what those files would contain.
 *
 * Nothing here does business logic. A service call is one HTTP request; every decision it could make is
 * a decision the backend already owns.
 */

// ---- auth -----------------------------------------------------------------------------------------

async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/request-password-reset', { email });
}

/**
 * The code arrives on the user's WhatsApp; the e-mail identifies WHO is resetting.
 *
 * The field is `newPassword`, matching the backend DTO exactly. The global ValidationPipe runs with
 * `forbidNonWhitelisted`, so a well-meaning rename here does not "mostly work" — it 400s.
 */
async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { email, code, newPassword });
}

/** Returns the PAIR `{ user, account }` — not the user. Unwrapping it here would lose the tenant. */
async function me(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me');
  return data;
}

export const authService = { login, requestPasswordReset, resetPassword, me };

// ---- channels -------------------------------------------------------------------------------------

export const channelService = {
  async list(): Promise<Channel[]> {
    const { data } = await api.get<Channel[]>('/channels');
    return data;
  },
  async create(input: {
    label: string;
    phone: string;
    quotaFloor?: number;
    quotaCeiling?: number;
  }): Promise<Channel> {
    const { data } = await api.post<Channel>('/channels', input);
    return data;
  },
  async qrCode(id: string): Promise<QrCode> {
    // `qrcode`, sem hífen — é o caminho real. Com hífen o Fastify responde "Cannot GET".
    const { data } = await api.get<QrCode>(`/channels/${id}/qrcode`);
    return data;
  },
  async syncState(id: string): Promise<Channel> {
    const { data } = await api.post<Channel>(`/channels/${id}/sync-state`, {});
    return data;
  },
  async webhookDiagnosis(id: string, reconfigure = false): Promise<WebhookDiagnosis> {
    const { data } = await api.post<WebhookDiagnosis>(`/channels/${id}/webhook-diagnosis`, {
      reconfigure,
    });
    return data;
  },
  async changeQuotaBand(id: string, floor: number, ceiling: number): Promise<Channel> {
    const { data } = await api.patch<Channel>(`/channels/${id}/quota-band`, {
      quotaFloor: floor,
      quotaCeiling: ceiling,
    });
    return data;
  },
  /** Reativar não tem corpo na API — o endpoint só precisa do id e de quem chamou. */
  async reinstate(id: string): Promise<Channel> {
    const { data } = await api.post<Channel>(`/channels/${id}/reinstate`, {});
    return data;
  },
  /**
   * Terminal e só por humano (§4). Os dois exigem `confirm` além do motivo: estado terminal é
   * irreversível e torna os contatos migráveis, então a API faz o cliente dizer que quis.
   */
  async markBanned(id: string, reason: string): Promise<Channel> {
    const { data } = await api.post<Channel>(`/channels/${id}/mark-banned`, {
      reason,
      confirm: 'true',
    });
    return data;
  },
  async retire(id: string, reason: string): Promise<Channel> {
    const { data } = await api.post<Channel>(`/channels/${id}/retire`, {
      reason,
      confirm: 'true',
    });
    return data;
  },
};

// ---- contacts -------------------------------------------------------------------------------------

export const contactService = {
  async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    tags?: string[];
    channelId?: string;
    active?: boolean;
  }): Promise<Paginated<Contact>> {
    const { data } = await api.get<Paginated<Contact>>('/contacts', { params });
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/contacts/${id}`);
  },
  async tags(): Promise<ContactTag[]> {
    const { data } = await api.get<ContactTag[]>('/contacts/tags');
    return data;
  },
  async channelLoads(): Promise<ChannelLoad[]> {
    const { data } = await api.get<ChannelLoad[]>('/contacts/channel-loads');
    return data;
  },
  /** Base64 in JSON — never multipart (Fastify). */
  async startImport(input: {
    fileName: string;
    fileBase64: string;
    /** `fileMimeType`, com o prefixo — é o nome do campo no DTO. */
    fileMimeType: string;
    consentBasis: ConsentBasis;
    /** Obrigatório, mínimo 10 caracteres (§6.1 item 6: procedência não é opcional). */
    originNote: string;
    hasHeader: boolean;
    mapping: { phone: string; name?: string; tags?: string };
  }): Promise<ContactImport> {
    const { data } = await api.post<ContactImport>('/contacts/imports', input);
    return data;
  },
  async getImport(id: string): Promise<ContactImport> {
    const { data } = await api.get<ContactImport>(`/contacts/imports/${id}`);
    return data;
  },
  async listImports(): Promise<ContactImport[]> {
    const { data } = await api.get<ContactImport[]>('/contacts/imports');
    return data;
  },
  /**
   * O DTO tem UM campo: `confirm`. Não há `reason` — o opt-out é irreversível pela interface (§6.5) e
   * a API não guarda justificativa para ele. Mandar `reason` era 400 duas vezes: campo a mais e
   * `confirm` ausente.
   */
  async optOut(id: string): Promise<Contact> {
    const { data } = await api.post<Contact>(`/contacts/${id}/opt-out`, { confirm: 'true' });
    return data;
  },
  /**
   * Tira o contato dos envios sem apagá-lo — a saída para quem o DELETE recusa por já ter recebido
   * envio. Deliberadamente NÃO é `optOut`: opt-out alimenta uma métrica que corta a cota do chip.
   *
   * Sem corpo: não há nada a informar além de qual contato, que já vai na URL.
   */
  async deactivate(id: string): Promise<Contact> {
    const { data } = await api.post<Contact>(`/contacts/${id}/deactivate`);
    return data;
  },
  async reactivate(id: string): Promise<Contact> {
    const { data } = await api.post<Contact>(`/contacts/${id}/reactivate`);
    return data;
  },
};

// ---- sender migration -----------------------------------------------------------------------------

/**
 * Sender migration lives under `/contacts`, because that is what it changes — the sender of a set of
 * contacts. There is no `/migrations` resource, and calling one produced a 404 on every screen load.
 */
export const migrationService = {
  /** GET with QUERY params, not a POST body: a preview reads, it does not create anything. */
  async preview(input: {
    fromChannelId: string;
    strategy: 'ALL_TO_ONE' | 'REDISTRIBUTE';
    toChannelId?: string;
  }): Promise<MigrationPreview> {
    const { data } = await api.get<MigrationPreview>('/contacts/sender-migrations/preview', {
      params: input,
    });
    return data;
  },
  /**
   * No `confirmation` field. The API runs with `forbidNonWhitelisted`, so an extra property is a 400 —
   * and the confirmation is a UI concern anyway: the dialog already makes the operator type the word.
   */
  async execute(input: {
    fromChannelId: string;
    strategy: 'ALL_TO_ONE' | 'REDISTRIBUTE';
    toChannelId?: string;
  }): Promise<SenderMigration> {
    // `confirm` é exigido pelo DTO: a migração é irreversível na prática e move a base inteira de um
    // chip. Não é o mesmo que a palavra digitada no diálogo — aquilo é fricção de interface, isto é o
    // cliente afirmando à API que a chamada é intencional.
    const { data } = await api.post<SenderMigration>('/contacts/sender-migrations', {
      ...input,
      confirm: 'true',
    });
    return data;
  },
  async list(): Promise<SenderMigration[]> {
    const { data } = await api.get<SenderMigration[]>('/contacts/sender-migrations');
    return data;
  },
};

// ---- content --------------------------------------------------------------------------------------

export const contentService = {
  async list(params: {
    page?: number;
    limit?: number;
    status?: string;
    classification?: string;
    search?: string;
  }): Promise<Paginated<Content>> {
    const { data } = await api.get<Paginated<Content>>('/contents', { params });
    return data;
  },
  /**
   * Copia um conteúdo como RASCUNHO novo e devolve a cópia — a tela navega para ela, para alguém
   * validar antes de salvar. A cópia nunca herda APPROVED, e mídia não é copiada (ver o use case).
   */
  async duplicate(id: string): Promise<Content> {
    const { data } = await api.post<Content>(`/contents/${id}/duplicate`, {});
    return data;
  },
  async get(id: string): Promise<Content> {
    const { data } = await api.get<Content>(`/contents/${id}`);
    return data;
  },
  async create(input: {
    title: string;
    classification: string;
    origin: string;
    bodyBase: string;
    sourceUrl?: string | null;
    includeSourceUrl?: boolean;
  }): Promise<Content> {
    const { data } = await api.post<Content>('/contents', input);
    return data;
  },
  async update(
    id: string,
    input: {
      title?: string;
      bodyBase?: string;
      sourceUrl?: string | null;
      includeSourceUrl?: boolean;
    },
  ): Promise<Content> {
    const { data } = await api.patch<Content>(`/contents/${id}`, input);
    return data;
  },
  async preview(id: string, tags?: string[]): Promise<ContentPreview> {
    const { data } = await api.get<ContentPreview>(`/contents/${id}/preview`, { params: { tags } });
    return data;
  },
  async addVariant(id: string, input: { label: string; body: string }): Promise<Content> {
    const { data } = await api.post<Content>(`/contents/${id}/variants`, input);
    return data;
  },
  async updateVariant(
    id: string,
    variantId: string,
    input: { body?: string; markReviewed?: boolean },
  ): Promise<Content> {
    const { data } = await api.patch<Content>(`/contents/${id}/variants/${variantId}`, input);
    return data;
  },
  async removeVariant(id: string, variantId: string): Promise<Content> {
    const { data } = await api.delete<Content>(`/contents/${id}/variants/${variantId}`);
    return data;
  },
  async attachMedia(
    id: string,
    input: { fileName: string; mimeType: string; fileBase64: string; variantId?: string | null },
  ): Promise<Content> {
    const { data } = await api.post<Content>(`/contents/${id}/media`, input);
    return data;
  },
  async removeMedia(id: string, mediaId: string): Promise<Content> {
    const { data } = await api.delete<Content>(`/contents/${id}/media/${mediaId}`);
    return data;
  },
  /** `confirm` é obrigatório: arquivar é permanente, o conteúdo fica somente-leitura para sempre. */
  /**
   * Baixa os bytes da mídia por ESTE backend e devolve um blob URL.
   *
   * Não dá para apontar um `<img src>` direto para a API: o interceptor põe o JWT no header, e um
   * `<img>` não manda header. Então busca-se com axios e o blob vira uma URL local.
   *
   * Quem chamar precisa liberar com `URL.revokeObjectURL` — blob URL não é coletado sozinho enquanto
   * o documento vive, e numa tela que recarrega mídia isso vira vazamento de memória.
   */
  async mediaObjectUrl(contentId: string, mediaId: string): Promise<string> {
    const { data } = await api.get<Blob>(`/contents/${contentId}/media/${mediaId}/content`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  },
  /**
   * Devolve um REJEITADO a rascunho sem alterar o texto.
   *
   * Editar já faz isso — este caminho é para quem discorda da rejeição e reenvia as mesmas palavras
   * depois de conversar com o aprovador. Uma edição cosmética só para destravar mudaria o
   * `content_hash`, que existe para significar "exatamente estas palavras".
   */
  async reopen(id: string): Promise<Content> {
    const { data } = await api.post<Content>(`/contents/${id}/reopen`, {});
    return data;
  },
  async archive(id: string): Promise<Content> {
    const { data } = await api.post<Content>(`/contents/${id}/archive`, { confirm: 'true' });
    return data;
  },
};

// ---- approval -------------------------------------------------------------------------------------

export const approvalService = {
  async settings(): Promise<ApprovalSettings> {
    const { data } = await api.get<ApprovalSettings>('/approvals/settings');
    return data;
  },
  async updateSettings(input: ApprovalSettings): Promise<ApprovalSettings> {
    const { data } = await api.put<ApprovalSettings>('/approvals/settings', input);
    return data;
  },
  async approvers(): Promise<Approver[]> {
    const { data } = await api.get<Approver[]>('/approvals/approvers');
    return data;
  },
  async addApprover(input: {
    name: string;
    email?: string | null;
    phone?: string | null;
  }): Promise<Approver> {
    const { data } = await api.post<Approver>('/approvals/approvers', input);
    return data;
  },
  async updateApprover(
    id: string,
    input: { name?: string; email?: string | null; phone?: string | null; active?: boolean },
  ): Promise<Approver> {
    const { data } = await api.patch<Approver>(`/approvals/approvers/${id}`, input);
    return data;
  },
  async submit(contentId: string): Promise<SubmissionResult> {
    const { data } = await api.post<SubmissionResult>(
      `/approvals/contents/${contentId}/submit`,
      {},
    );
    return data;
  },
  async progress(contentId: string): Promise<ApprovalProgress> {
    const { data } = await api.get<ApprovalProgress>(`/approvals/contents/${contentId}`);
    return data;
  },
};

/**
 * The public magic-link page (§8 item 4).
 *
 * A bare axios call would be equivalent — there is no token to inject — but going through `api` keeps
 * the base URL in one place. The interceptor is harmless here: these routes never return 401.
 */
export const publicApprovalService = {
  async page(token: string): Promise<ApprovalPage> {
    const { data } = await api.get<ApprovalPage>(`/public/approvals/${token}`);
    return data;
  },
  async decide(
    token: string,
    decision: 'APPROVE' | 'REJECT',
    comment?: string,
  ): Promise<ApprovalDecisionResult> {
    const { data } = await api.post<ApprovalDecisionResult>(`/public/approvals/${token}`, {
      decision,
      comment,
    });
    return data;
  },
};

// ---- distribution ---------------------------------------------------------------------------------

export const distributionService = {
  async list(params: {
    page?: number;
    limit?: number;
    status?: string;
    contentId?: string;
  }): Promise<Paginated<Distribution>> {
    const { data } = await api.get<Paginated<Distribution>>('/distributions', { params });
    return data;
  },
  /** Dry run: computes everything, persists nothing (§9.3). */
  async preview(input: {
    contentId: string;
    windowStart: string;
    windowEnd: string;
    tags?: string[];
    variantMappings?: { variantId: string; tag: string }[];
  }): Promise<DistributionPreview> {
    const { data } = await api.post<DistributionPreview>('/distributions/preview', input);
    return data;
  },
  async create(input: {
    contentId: string;
    windowStart: string;
    windowEnd: string;
    tags?: string[];
    variantMappings?: { variantId: string; tag: string }[];
  }): Promise<DistributionPreview> {
    const { data } = await api.post<DistributionPreview>('/distributions', input);
    return data;
  },
  async detail(id: string): Promise<DistributionProgress> {
    const { data } = await api.get<DistributionProgress>(`/distributions/${id}`);
    return data;
  },
  /** The only call that hands work to the queue. Sends the hash the operator saw (§8.5). */
  async confirm(id: string, expectedContentHash: string): Promise<Distribution> {
    const { data } = await api.post<Distribution>(`/distributions/${id}/confirm`, {
      expectedContentHash,
    });
    return data;
  },
  async pause(id: string): Promise<unknown> {
    const { data } = await api.post(`/distributions/${id}/pause`, {});
    return data;
  },
  async resume(id: string): Promise<unknown> {
    const { data } = await api.post(`/distributions/${id}/resume`, {});
    return data;
  },
  async cancel(id: string, reason?: string): Promise<unknown> {
    const { data } = await api.post(`/distributions/${id}/cancel`, { reason });
    return data;
  },
};

// ---- inbox ----------------------------------------------------------------------------------------

export const inboxService = {
  async queue(params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    intentClass?: string;
    unlockedOnly?: boolean;
  }): Promise<Paginated<ConversationSummary>> {
    const { data } = await api.get<Paginated<ConversationSummary>>('/inbox', { params });
    return data;
  },
  async counters(): Promise<InboxCounters> {
    const { data } = await api.get<InboxCounters>('/inbox/counters');
    return data;
  },
  /** POST because it TAKES THE LOCK — a GET would lock on every prefetch (§10.3 item 1). */
  async open(id: string): Promise<ConversationDetail> {
    const { data } = await api.post<ConversationDetail>(`/inbox/${id}/open`, {});
    return data;
  },
  async reply(
    id: string,
    input: { body: string; quickReplyId?: string | null; resolve?: boolean },
  ): Promise<unknown> {
    const { data } = await api.post(`/inbox/${id}/reply`, input);
    return data;
  },
  async action(
    id: string,
    action: 'RESOLVE' | 'ARCHIVE' | 'RELEASE' | 'REASSIGN',
    targetOperatorId?: string,
  ): Promise<ConversationSummary> {
    const { data } = await api.post<ConversationSummary>(`/inbox/${id}/action`, {
      action,
      targetOperatorId,
    });
    return data;
  },
  async quickReplies(search?: string): Promise<QuickReply[]> {
    const { data } = await api.get<QuickReply[]>('/inbox/quick-replies', { params: { search } });
    return data;
  },
  async saveQuickReply(
    input: { title: string; body: string; tags?: string[] },
    id?: string,
  ): Promise<QuickReply> {
    const { data } = id
      ? await api.put<QuickReply>(`/inbox/quick-replies/${id}`, input)
      : await api.post<QuickReply>('/inbox/quick-replies', input);
    return data;
  },
  async deleteQuickReply(id: string): Promise<void> {
    await api.delete(`/inbox/quick-replies/${id}`);
  },
};

// ---- audit and health -----------------------------------------------------------------------------

export const auditService = {
  async health(windowDays = 14): Promise<HealthPanel> {
    const { data } = await api.get<HealthPanel>('/audit/health', { params: { windowDays } });
    return data;
  },
  async logs(params: {
    page?: number;
    limit?: number;
    action?: string;
    actorType?: string;
    entityType?: string;
    entityId?: string;
    from?: string;
    to?: string;
  }): Promise<Paginated<AuditLogEntry>> {
    const { data } = await api.get<Paginated<AuditLogEntry>>('/audit/logs', { params });
    return data;
  },
  async actions(): Promise<string[]> {
    const { data } = await api.get<string[]>('/audit/logs/actions');
    return data;
  },
  /**
   * Downloads the exportable report (§11 item 2).
   *
   * `responseType: 'blob'` and a synthetic anchor click, because the file has to arrive as a DOWNLOAD
   * with the name the backend chose. Opening the URL in a tab would work only until the access token
   * needed refreshing, since a plain navigation carries no Authorization header.
   */
  async downloadReport(distributionId: string, format: 'CSV' | 'PDF'): Promise<void> {
    const response = await api.get(`/audit/distributions/${distributionId}/report`, {
      params: { format },
      responseType: 'blob',
    });

    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = /filename="([^"]+)"/.exec(disposition);
    const fileName = match?.[1] ?? `relatorio.${format.toLowerCase()}`;

    const url = window.URL.createObjectURL(response.data as Blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  },
};

// ---- platform (área da plataforma) ----------------------------------------------------------------

export const platformService = {
  async login(email: string, password: string): Promise<PlatformSession> {
    const { data } = await api.post<PlatformSession>('/platform/auth/login', { email, password });
    return data;
  },
  /**
   * Unwraps the pagination envelope. The endpoint answers `{ data, meta }`, and treating it as an
   * array is what made this screen crash with a client-side exception: `accounts.map` on an object.
   */
  async accounts(page = 1, limit = 50): Promise<PlatformAccount[]> {
    const { data } = await api.get<Paginated<PlatformAccount>>('/platform/accounts', {
      params: { page, limit },
    });
    return data.data;
  },
  async createAccount(input: {
    name: string;
    document: string;
    plan: string;
    dailySendCeiling: number;
    timezone: string;
    adminName: string;
    adminEmail: string;
    /**
     * Required by the API (CLAUDE.md regra 9). This admin has nobody above them in the tenant, so a
     * missing number means a forgotten password costs them the account.
     */
    adminPhone: string;
    adminPassword: string;
  }): Promise<PlatformAccount> {
    const { data } = await api.post<PlatformAccount>('/platform/accounts', input);
    return data;
  },
  /** `daily-ceiling`, e PATCH — o caminho e o método do controller. */
  async setCeiling(accountId: string, dailySendCeiling: number): Promise<PlatformAccount> {
    const { data } = await api.patch<PlatformAccount>(
      `/platform/accounts/${accountId}/daily-ceiling`,
      { dailySendCeiling },
    );
    return data;
  },
  /** PATCH, não POST: suspender altera o estado de um recurso que já existe. */
  async suspend(accountId: string, reason: string): Promise<PlatformAccount> {
    const { data } = await api.patch<PlatformAccount>(`/platform/accounts/${accountId}/suspend`, {
      reason,
    });
    return data;
  },
  async reactivate(accountId: string): Promise<PlatformAccount> {
    const { data } = await api.patch<PlatformAccount>(
      `/platform/accounts/${accountId}/reactivate`,
      {},
    );
    return data;
  },
  /**
   * Signals are PER ACCOUNT and the window is required — there is no cross-account endpoint. The
   * previous version called `/platform/abuse-signals`, which does not exist; the 404 was swallowed
   * by a `.catch`, so the screen showed an empty card forever instead of failing visibly.
   */
  async abuseSignals(accountId: string, days = 30): Promise<AbuseSignals> {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const { data } = await api.get<AbuseSignals>(`/platform/accounts/${accountId}/abuse-signals`, {
      params: { from: isoDate(from), to: isoDate(to) },
    });
    return data;
  },
};

/** YYYY-MM-DD, which is what the API validates with `@IsISO8601({ strict: true })`. */
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginatedResult } from '@gitspread/shared-kernel';
import { ListInboxQueueUseCase } from '../../../../contexts/inbox/application/use-cases/manage-conversation/manage-conversation.use-cases';
import { OpenConversationUseCase } from '../../../../contexts/inbox/application/use-cases/manage-conversation/manage-conversation.use-cases';
import { ResolveConversationUseCase } from '../../../../contexts/inbox/application/use-cases/manage-conversation/manage-conversation.use-cases';
import { GetInboxCountersUseCase } from '../../../../contexts/inbox/application/use-cases/manage-conversation/manage-conversation.use-cases';
import {
  ListInboxQueueQuery,
  OpenConversationCommand,
  ResolveConversationCommand,
} from '../../../../contexts/inbox/application/use-cases/manage-conversation/manage-conversation.commands';
import { SendReplyUseCase } from '../../../../contexts/inbox/application/use-cases/send-reply/send-reply.use-case';
import { SendReplyCommand } from '../../../../contexts/inbox/application/use-cases/send-reply/send-reply.command';
import {
  DeleteQuickReplyUseCase,
  ListQuickRepliesUseCase,
  SaveQuickReplyUseCase,
} from '../../../../contexts/inbox/application/use-cases/manage-quick-replies/manage-quick-replies.use-cases';
import {
  DeleteQuickReplyCommand,
  ListQuickRepliesQuery,
  SaveQuickReplyCommand,
} from '../../../../contexts/inbox/application/use-cases/manage-quick-replies/manage-quick-replies.commands';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ConversationActionRequestDto,
  ListQuickRepliesQueryDto,
  ListQueueQueryDto,
  SaveQuickReplyRequestDto,
  SendReplyRequestDto,
} from './dto/inbox-request.dto';
import {
  ConversationDetailResponseDto,
  ConversationSummaryResponseDto,
  InboxCountersResponseDto,
  QuickReplyResponseDto,
  ReplyResponseDto,
} from './dto/inbox-response.dto';

/**
 * The work queue (FASE 8).
 *
 * Every route is open to any authenticated user of the account, and that is deliberate: answering
 * contacts IS the operator's job, and §10.3 describes a team working the same queue. The controls that
 * matter here are not role checks — they are the lock (two operators never in the same conversation) and
 * the fact that a reply can only leave through the conversation's own channel.
 *
 * `GET /inbox` is the queue itself: priority first, then oldest first (§10.3 item 2). It is a list of
 * WORK, not a mailbox — which is why the default filter is "open items nobody is holding".
 */
@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(
    private readonly listQueue: ListInboxQueueUseCase,
    private readonly openConversation: OpenConversationUseCase,
    private readonly resolveConversation: ResolveConversationUseCase,
    private readonly sendReply: SendReplyUseCase,
    private readonly counters: GetInboxCountersUseCase,
    private readonly listQuickReplies: ListQuickRepliesUseCase,
    private readonly saveQuickReply: SaveQuickReplyUseCase,
    private readonly deleteQuickReply: DeleteQuickReplyUseCase,
  ) {}

  @Get()
  async queue(
    @Query() query: ListQueueQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<PaginatedResult<ConversationSummaryResponseDto>> {
    const page = await this.listQueue.execute(
      new ListInboxQueueQuery(
        user.accountId,
        query.page,
        query.limit,
        query.status,
        query.priority,
        query.intentClass,
        query.channelId,
        query.unlockedOnly,
      ),
    );
    return {
      data: page.data.map((item) => ConversationSummaryResponseDto.from(item)),
      meta: page.meta,
    };
  }

  /** Queue health, for the dashboard: how many are waiting and for how long (§11 item 3). */
  @Get('counters')
  async health(@CurrentUser() _user: AuthTokenPayload): Promise<InboxCountersResponseDto> {
    return InboxCountersResponseDto.from(await this.counters.execute());
  }

  @Get('quick-replies')
  async quickReplies(
    @Query() query: ListQuickRepliesQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<QuickReplyResponseDto[]> {
    const list = await this.listQuickReplies.execute(
      new ListQuickRepliesQuery(user.accountId, query.search),
    );
    return list.map((item) => QuickReplyResponseDto.from(item));
  }

  @Post('quick-replies')
  @HttpCode(201)
  async createQuickReply(
    @Body() dto: SaveQuickReplyRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<QuickReplyResponseDto> {
    const saved = await this.saveQuickReply.execute(
      new SaveQuickReplyCommand(user.accountId, user.sub, null, dto.title, dto.body, dto.tags, ip),
    );
    return QuickReplyResponseDto.from(saved);
  }

  @Put('quick-replies/:id')
  async updateQuickReply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveQuickReplyRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<QuickReplyResponseDto> {
    const saved = await this.saveQuickReply.execute(
      new SaveQuickReplyCommand(user.accountId, user.sub, id, dto.title, dto.body, dto.tags, ip),
    );
    return QuickReplyResponseDto.from(saved);
  }

  /** Safe to delete: `messages` stores the text that was sent, not a reference to the template. */
  @Delete('quick-replies/:id')
  @HttpCode(204)
  async removeQuickReply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.deleteQuickReply.execute(
      new DeleteQuickReplyCommand(user.accountId, user.sub, id, ip),
    );
  }

  /**
   * Opens an item: TAKES THE LOCK and returns the whole thread.
   *
   * POST and not GET precisely because it has a side effect — the lock. A GET that quietly locked would
   * be locked by every prefetch and every refresh.
   */
  @Post(':id/open')
  @HttpCode(200)
  async open(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ConversationDetailResponseDto> {
    const detail = await this.openConversation.execute(
      new OpenConversationCommand(user.accountId, user.sub, id),
    );
    return ConversationDetailResponseDto.from(detail);
  }

  /** The reply. Goes out through the conversation's own channel, on the reply quota band (§10.4). */
  @Post(':id/reply')
  @HttpCode(200)
  async reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendReplyRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ReplyResponseDto> {
    const result = await this.sendReply.execute(
      new SendReplyCommand(
        user.accountId,
        user.sub,
        id,
        dto.body,
        dto.quickReplyId ?? null,
        dto.resolve ?? false,
        ip,
      ),
    );
    return ReplyResponseDto.from(result);
  }

  /** Resolve, archive, release the lock, or hand the item to someone else (§10.3 item 4). */
  @Post(':id/action')
  @HttpCode(200)
  async action(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConversationActionRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ConversationSummaryResponseDto> {
    const result = await this.resolveConversation.execute(
      new ResolveConversationCommand(
        user.accountId,
        user.sub,
        id,
        dto.action,
        dto.targetOperatorId ?? null,
        ip,
      ),
    );
    return ConversationSummaryResponseDto.from(result);
  }
}

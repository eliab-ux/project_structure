import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  OrderEvidenceResult,
  RegisterOrderEvidenceCommand,
  RegisterOrderEvidenceUseCase,
} from '../../../../contexts/route/application/use-cases/register-order-evidence/register-order-evidence.use-case';
import {
  ChangeOrderGpsCommand,
  ChangeOrderGpsResult,
  ChangeOrderGpsUseCase,
} from '../../../../contexts/route/application/use-cases/change-order-gps/change-order-gps.use-case';
import {
  GeneratePromissoryNoteCommand,
  GeneratePromissoryNoteUseCase,
  PromissoryNoteResult,
} from '../../../../contexts/route/application/use-cases/generate-promissory-note/generate-promissory-note.use-case';
import { EvidenceType } from '../../../../contexts/route/domain/entities/order-evidence.entity';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ChangeOrderGpsRequestDto,
  GeneratePromissoryRequestDto,
  RegisterOrderEvidenceRequestDto,
} from './dto/consignment-request.dto';

/**
 * Evidências + promissória do pedido consignado — ROT fatia 6 (§3.1 do 04). `@RequireModule(ROT)`;
 * `rot.trip.manage` (operação da retaguarda; o app do campo terá autorização própria).
 */
@Controller('consignment/orders')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.ROT)
export class ConsignmentController {
  constructor(
    private readonly registerEvidence: RegisterOrderEvidenceUseCase,
    private readonly changeGps: ChangeOrderGpsUseCase,
    private readonly generatePromissory: GeneratePromissoryNoteUseCase,
  ) {}

  /** Registra evidência (GPS da abertura — uma vez; fotos com binário base64 → storage). */
  @Post(':id/evidences')
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.rot.trip)
  async addEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterOrderEvidenceRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderEvidenceResult> {
    return this.registerEvidence.execute(
      new RegisterOrderEvidenceCommand(actor.accountId, {
        orderId: id,
        tripId: dto.tripId ?? null,
        type: dto.type as EvidenceType,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        fileBase64: dto.fileBase64 ?? null,
        fileMimeType: dto.fileMimeType ?? null,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : null,
      }),
    );
  }

  /** A ÚNICA forma de alterar o GPS: ação explícita auditada (quem = token; anterior preservado). */
  @Post(':id/gps-change')
  @RequirePermission(PERMISSIONS.rot.trip)
  async gpsChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrderGpsRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ChangeOrderGpsResult> {
    return this.changeGps.execute(
      new ChangeOrderGpsCommand(actor.accountId, actor.sub, {
        orderId: id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        reason: dto.reason,
      }),
    );
  }

  /** Gera a promissória (1 por pedido; 2ª via = reler a existente). */
  @Post(':id/promissory')
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.rot.trip)
  async promissory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GeneratePromissoryRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<PromissoryNoteResult> {
    return this.generatePromissory.execute(
      new GeneratePromissoryNoteCommand(actor.accountId, {
        orderId: id,
        dueDate: new Date(dto.dueDate),
        debtorAddress: dto.debtorAddress ?? null,
      }),
    );
  }
}

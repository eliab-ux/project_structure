import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateCompanyUseCase } from '../../../../contexts/company/application/use-cases/create-company/create-company.use-case';
import { CreateCompanyCommand } from '../../../../contexts/company/application/use-cases/create-company/create-company.command';
import {
  UpdateCompanyCommand,
  UpdateCompanyUseCase,
} from '../../../../contexts/company/application/use-cases/update-company/update-company.use-case';
import {
  ListCompaniesQuery,
  ListCompaniesUseCase,
} from '../../../../contexts/company/application/use-cases/list-companies/list-companies.use-case';
import {
  GetCompanyQuery,
  GetCompanyUseCase,
} from '../../../../contexts/company/application/use-cases/get-company/get-company.use-case';
import {
  SetCompanyStatusCommand,
  SetCompanyStatusUseCase,
} from '../../../../contexts/company/application/use-cases/set-company-status/set-company-status.use-case';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreateCompanyRequestDto,
  SetCompanyStatusRequestDto,
  UpdateCompanyRequestDto,
} from './dto/company-request.dto';
import { CompanyResponseDto } from './dto/company-response.dto';

/**
 * `PermissionGuard` extends `JwtAuthGuard`, so every method here is authenticated AND tenant-scoped
 * before its permission is checked. Company ids in the path resolve only within the caller's
 * account — RLS makes "belongs to someone else" and "does not exist" the same answer.
 */
@Controller('companies')
@UseGuards(PermissionGuard)
export class CompanyController {
  constructor(
    private readonly createCompanyUseCase: CreateCompanyUseCase,
    private readonly updateCompanyUseCase: UpdateCompanyUseCase,
    private readonly listCompaniesUseCase: ListCompaniesUseCase,
    private readonly getCompanyUseCase: GetCompanyUseCase,
    private readonly setCompanyStatusUseCase: SetCompanyStatusUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.companies.read)
  async list(@Query('includeInactive') includeInactive?: string): Promise<CompanyResponseDto[]> {
    const companies = await this.listCompaniesUseCase.execute(
      new ListCompaniesQuery(includeInactive === 'true'),
    );
    return companies.map((company) => CompanyResponseDto.from(company));
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.companies.read)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyResponseDto> {
    return CompanyResponseDto.from(await this.getCompanyUseCase.execute(new GetCompanyQuery(id)));
  }

  @Post()
  @RequirePermission(PERMISSIONS.companies.create)
  async create(
    @Body() dto: CreateCompanyRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<CompanyResponseDto> {
    const company = await this.createCompanyUseCase.execute(
      new CreateCompanyCommand(
        // The tenant comes from the token, never from the payload.
        user.accountId,
        dto.legalName,
        dto.document,
        dto.taxRegime,
        dto.address,
        dto.stateRegistrationExempt,
        dto.tradeName,
        dto.stateRegistration,
        dto.municipalRegistration,
        dto.suframa,
        dto.cnae,
        dto.contactEmail,
        dto.billingEmail,
        dto.phone,
        dto.stateRegistrations,
      ),
    );
    return CompanyResponseDto.from(company);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.companies.update)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyRequestDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.updateCompanyUseCase.execute(
      new UpdateCompanyCommand(
        id,
        dto.legalName,
        dto.tradeName,
        dto.taxRegime,
        dto.stateRegistration,
        dto.stateRegistrationExempt,
        dto.municipalRegistration,
        dto.suframa,
        dto.cnae,
        dto.address,
        dto.contactEmail,
        dto.billingEmail,
        dto.phone,
        dto.stateRegistrations,
      ),
    );
    return CompanyResponseDto.from(company);
  }

  /**
   * PATCH and not DELETE: a company is deactivated, never removed. Fiscal documents reference it
   * for years, so the row has to stay readable — and the client needs the updated resource back,
   * which a 204 DELETE could not return.
   */
  @Patch(':id/status')
  @RequirePermission(PERMISSIONS.companies.delete)
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCompanyStatusRequestDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.setCompanyStatusUseCase.execute(
      new SetCompanyStatusCommand(id, dto.active),
    );
    return CompanyResponseDto.from(company);
  }
}

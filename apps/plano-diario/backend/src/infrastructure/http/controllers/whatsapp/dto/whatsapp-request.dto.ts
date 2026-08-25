import { IsIn, IsOptional } from 'class-validator';

/**
 * `refresh` é validado como STRING, não como boolean.
 *
 * Motivo: o `ValidationPipe` global usa `enableImplicitConversion: true` (necessário para os
 * params numéricos), e isso converte qualquer texto para boolean antes do `@IsBoolean()` —
 * `?refresh=ture` viraria `false` silenciosamente e o botão "Atualizar grupos" não atualizaria
 * nada, sem erro nenhum. Com `@IsIn`, um valor não reconhecido é recusado com 400.
 */
export class ListGroupsQueryDto {
  @IsOptional()
  @IsIn(['true', 'false', '1', '0'])
  refresh?: string;

  /** Conversão explícita, num único lugar. */
  get shouldRefresh(): boolean {
    return this.refresh === 'true' || this.refresh === '1';
  }
}

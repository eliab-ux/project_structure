import { ModuleDefinition } from '../../domain/modules.catalog';

/**
 * Um módulo do catálogo com o estado dele NESTA conta. É o que a tela de configurações precisa para
 * desenhar os toggles com as dependências visíveis (01_Veertex_Core §5).
 */
export class ModuleDto {
  code!: string;
  name!: string;
  description!: string;
  dependsOn!: string[];
  core!: boolean;
  /** No plano da conta. `false` → o toggle aparece bloqueado, com convite a upgrade. */
  availableInPlan!: boolean;
  /** Ligado pela conta. Core é sempre `true`. */
  active!: boolean;
  /** Módulos ativos que dependem deste — o que impede a desativação, exibido antes da tentativa. */
  blockingDependents!: string[];
  /** Dependências ainda inativas — o que impede a ativação. */
  missingDependencies!: string[];

  static from(params: {
    definition: ModuleDefinition;
    availableInPlan: boolean;
    active: boolean;
    blockingDependents: string[];
    missingDependencies: string[];
  }): ModuleDto {
    const dto = new ModuleDto();
    dto.code = params.definition.code;
    dto.name = params.definition.name;
    dto.description = params.definition.description;
    dto.dependsOn = [...params.definition.dependsOn];
    dto.core = params.definition.core;
    dto.availableInPlan = params.availableInPlan;
    dto.active = params.active;
    dto.blockingDependents = params.blockingDependents;
    dto.missingDependencies = params.missingDependencies;
    return dto;
  }
}

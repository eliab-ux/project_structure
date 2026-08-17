import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { FabricId } from '../value-objects/fabric-id.vo';

/** Teto de sanidade: nenhum enfesto real chega perto disso. */
const MAX_HEIGHT_CM = 999.99;

/** Teto de sanidade da espessura de UMA camada. Tecido de 10 cm por camada não existe. */
const MAX_THICKNESS_CM = 10;

/**
 * Tecido cadastrado (spec §4.5).
 *
 * Duas medidas, e elas **não são a mesma coisa**:
 *
 * - `maxLayerHeightCm` — a altura máxima do **enfesto inteiro**. É a restrição física: da mesa, da
 *   lâmina, do comportamento do material empilhado.
 * - `layerThicknessCm` — a espessura de **uma camada**. É propriedade do material.
 *
 * O número de camadas que cabe é **consequência das duas** (`altura ÷ espessura`), não substituto
 * de nenhuma. Guardar só uma delas foi o erro dimensional que a spec carregava: comparar `layers`
 * (contagem) com `maxLayerHeightCm` (centímetros) fazia o aviso disparar em quase todo corte.
 *
 * `layerThicknessCm` é **nullable e continua nullable**: enquanto não estiver medido, o sistema
 * não avisa nada. Silêncio vale mais que ruído — aviso que aparece sempre é aviso que ninguém lê,
 * e um número inventado para preencher campo obrigatório produz exatamente isso.
 *
 * O aviso, quando existe, é aviso e não bloqueio (§4.10): quem está na máquina sabe mais que o
 * cadastro.
 */
export class Fabric extends AggregateRoot {
  private constructor(
    private readonly _id: FabricId,
    private readonly _accountId: AccountId,
    private _name: string,
    private _maxLayerHeightCm: number,
    private _layerThicknessCm: number | null,
    private _notes: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    name: string;
    maxLayerHeightCm: number;
    layerThicknessCm?: number | null;
    notes?: string | null;
  }): Fabric {
    const now = new Date();
    return new Fabric(
      FabricId.create(),
      input.accountId,
      Fabric.assertName(input.name),
      Fabric.assertHeight(input.maxLayerHeightCm),
      Fabric.assertThickness(input.layerThicknessCm),
      input.notes?.trim() || null,
      now,
      now,
    );
  }

  static restore(input: {
    id: FabricId;
    accountId: AccountId;
    name: string;
    maxLayerHeightCm: number;
    layerThicknessCm: number | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Fabric {
    return new Fabric(
      input.id,
      input.accountId,
      input.name,
      input.maxLayerHeightCm,
      input.layerThicknessCm,
      input.notes,
      input.createdAt,
      input.updatedAt,
    );
  }

  update(input: {
    name: string;
    maxLayerHeightCm: number;
    layerThicknessCm?: number | null;
    notes?: string | null;
  }): void {
    this._name = Fabric.assertName(input.name);
    this._maxLayerHeightCm = Fabric.assertHeight(input.maxLayerHeightCm);
    this._layerThicknessCm = Fabric.assertThickness(input.layerThicknessCm);
    this._notes = input.notes?.trim() || null;
    this._updatedAt = new Date();
  }

  /**
   * Quantas camadas cabem na altura máxima, ou `null` enquanto a espessura não estiver medida.
   *
   * É este número — e não a altura em cm — que se compara com as camadas apontadas.
   */
  get maxLayers(): number | null {
    if (this._layerThicknessCm === null) {
      return null;
    }
    return Math.floor(this._maxLayerHeightCm / this._layerThicknessCm);
  }

  private static assertName(name: string): string {
    const value = (name ?? '').trim();
    if (value.length < 2 || value.length > 120) {
      throw new InvalidValueException('Nome do tecido deve ter entre 2 e 120 caracteres.');
    }
    return value;
  }

  private static assertHeight(height: number): number {
    if (typeof height !== 'number' || Number.isNaN(height) || height <= 0) {
      throw new InvalidValueException('Altura máxima de enfesto deve ser maior que zero.');
    }
    if (height > MAX_HEIGHT_CM) {
      throw new InvalidValueException('Altura máxima de enfesto acima do limite permitido.');
    }
    // Duas casas: é a precisão da coluna `numeric(5,2)`. Arredondar aqui evita gravar 2.499999 e
    // devolver 2.50 — divergência entre o que se digitou e o que se lê depois.
    return Math.round(height * 100) / 100;
  }

  /**
   * Espessura de uma camada. **Ausente é válido** — e é o caso comum enquanto ninguém mediu.
   *
   * Zero não é: um tecido de espessura zero comportaria infinitas camadas, e o aviso nunca
   * dispararia. Isso é indistinguível de "não cadastrado", mas sem a honestidade do nulo.
   */
  private static assertThickness(thickness: number | null | undefined): number | null {
    if (thickness === null || thickness === undefined) {
      return null;
    }
    if (typeof thickness !== 'number' || Number.isNaN(thickness) || thickness <= 0) {
      throw new InvalidValueException('Espessura da camada deve ser maior que zero.');
    }
    if (thickness > MAX_THICKNESS_CM) {
      throw new InvalidValueException('Espessura da camada acima do limite permitido.');
    }
    // Três casas: tecido fino é medido em milímetros (0,015 cm), e a coluna é `numeric(6,3)`.
    return Math.round(thickness * 1000) / 1000;
  }

  get id(): FabricId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get name(): string {
    return this._name;
  }

  get maxLayerHeightCm(): number {
    return this._maxLayerHeightCm;
  }

  get layerThicknessCm(): number | null {
    return this._layerThicknessCm;
  }

  get notes(): string | null {
    return this._notes;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}

import { Fabric } from '../../domain/entities/fabric.entity';
import { ProductType } from '../../domain/entities/product-type.entity';

/**
 * Tecido. Servido a **todos os papéis**, inclusive `modelista` — ele é quem mais precisa deste
 * dado, e não há nada de sensível nem monetário aqui (spec §5: "Cadastrar tecido, tipo de
 * produto" é ✅ para os três).
 */
export class FabricDto {
  id!: string;
  maxLayerHeightCm!: number;
  name!: string;
  /** Espessura de uma camada. `null` = ainda não medida, e nesse caso não há aviso de altura. */
  layerThicknessCm!: number | null;
  /** `altura máxima ÷ espessura`, ou `null` sem espessura. É o número que a tela mostra. */
  maxLayers!: number | null;
  notes!: string | null;

  static fromDomain(fabric: Fabric): FabricDto {
    const dto = new FabricDto();
    dto.id = fabric.id.value;
    dto.name = fabric.name;
    dto.maxLayerHeightCm = fabric.maxLayerHeightCm;
    dto.layerThicknessCm = fabric.layerThicknessCm;
    dto.maxLayers = fabric.maxLayers;
    dto.notes = fabric.notes;
    return dto;
  }
}

export class ProductTypeDto {
  id!: string;
  name!: string;

  static fromDomain(productType: ProductType): ProductTypeDto {
    const dto = new ProductTypeDto();
    dto.id = productType.id.value;
    dto.name = productType.name;
    return dto;
  }
}

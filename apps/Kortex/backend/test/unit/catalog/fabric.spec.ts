import { Fabric } from '../../../src/contexts/catalog/domain/entities/fabric.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';

describe('Fabric — as duas medidas do enfesto', () => {
  const accountId = AccountId.create();

  it('nasce sem espessura: o cadastro incompleto é estado legítimo, não erro', () => {
    const fabric = Fabric.create({ accountId, name: 'Malha', maxLayerHeightCm: 2.5 });

    expect(fabric.layerThicknessCm).toBeNull();
    // Sem espessura não há teto calculável — e o domínio devolve `null` em vez de fingir um.
    expect(fabric.maxLayers).toBeNull();
  });

  it('com espessura, maxLayers é a divisão das duas medidas', () => {
    const fabric = Fabric.create({
      accountId,
      name: 'Malha',
      maxLayerHeightCm: 2.5,
      layerThicknessCm: 0.05,
    });

    expect(fabric.maxLayers).toBe(50);
  });

  it('maxLayers arredonda para BAIXO — camada parcial não existe', () => {
    const fabric = Fabric.create({
      accountId,
      name: 'Jeans',
      maxLayerHeightCm: 5,
      layerThicknessCm: 0.7,
    });

    // 5 ÷ 0,7 = 7,14 — cabem 7 camadas inteiras, não 8.
    expect(fabric.maxLayers).toBe(7);
  });

  it('espessura zero é recusada — ausência se diz com nulo', () => {
    expect(() =>
      Fabric.create({ accountId, name: 'Malha', maxLayerHeightCm: 2.5, layerThicknessCm: 0 }),
    ).toThrow(InvalidValueException);
  });

  it('altura e espessura são independentes — mudar uma não mexe na outra', () => {
    const fabric = Fabric.create({
      accountId,
      name: 'Malha',
      maxLayerHeightCm: 2.5,
      layerThicknessCm: 0.05,
    });

    // Mesa maior: a altura sobe, a espessura do material continua a mesma, e cabem mais camadas.
    fabric.update({ name: 'Malha', maxLayerHeightCm: 5, layerThicknessCm: 0.05 });

    expect(fabric.maxLayerHeightCm).toBe(5);
    expect(fabric.layerThicknessCm).toBe(0.05);
    expect(fabric.maxLayers).toBe(100);
  });

  it('editar sem informar a espessura a apaga — o formulário é a fonte da verdade', () => {
    const fabric = Fabric.create({
      accountId,
      name: 'Malha',
      maxLayerHeightCm: 2.5,
      layerThicknessCm: 0.05,
    });

    fabric.update({ name: 'Malha', maxLayerHeightCm: 2.5 });

    expect(fabric.layerThicknessCm).toBeNull();
  });
});

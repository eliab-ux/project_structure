import { DomainException } from '@gitspread/domain-primitives';

export class PreOrderNotFoundException extends DomainException {
  constructor() {
    super('Pré-pedido não encontrado.');
  }
}

/**
 * Vira 403.
 *
 * Spec §4.7 e §5: **só o Modelista define `estimated_hours`** — nem o Administrativo, nem o dono.
 * A regra 6.1 explica por quê: o cliente não sabe quanto tempo precisa, quem avalia tecido,
 * metragem e quantidade é o Modelista. Se o Administrativo pudesse ajustar as horas, ele estaria
 * decidindo o preço da venda sem ter visto o tecido.
 */
export class ForbiddenHoursChangeException extends DomainException {
  constructor() {
    super('Somente o Modelista define as horas estimadas de um pré-pedido.');
  }
}

/** Vira 400. Pré-pedido já reservado ou descartado não volta a ser editável. */
export class PreOrderNotEditableException extends DomainException {
  constructor(status: string) {
    const motivo = status === 'reserved' ? 'já virou reserva' : 'foi descartado';
    super(`Este pré-pedido ${motivo} e não pode mais ser alterado.`);
  }
}

/**
 * O Administrativo tentou abrir um pedido para um tecido sem histórico. Vira 400.
 *
 * A regra 6.1 existe porque o cliente não sabe quanto tempo precisa: quem estima é quem opera a
 * máquina. Isso vale para o PRIMEIRO corte de um tecido — a partir do segundo, a estimativa deixa
 * de ser conhecimento tácito e vira dado: mediana de camadas, de peças encaixadas e de minutos por
 * 100 peças, tudo já registrado.
 *
 * Por isso a liberação é condicional e não geral. Sem nenhum corte concluído, o Administrativo
 * estaria digitando um número que ninguém tem como sustentar.
 */
export class NoCutHistoryForAdminException extends DomainException {
  constructor(fabricName: string) {
    super(
      `Ainda não há corte concluído com ${fabricName}: a primeira estimativa é do Modelista. ` +
        'A partir do segundo corte deste tecido o histórico sustenta o número e você pode abrir o pedido aqui.',
    );
  }
}

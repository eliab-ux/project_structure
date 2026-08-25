import { classifyInbound } from '../../../src/contexts/inbox/domain/services/intent-classifier';
import { IntentClass } from '../../../src/contexts/inbox/domain/value-objects/intent-class.vo';
import { MessageKind } from '../../../src/contexts/inbox/domain/value-objects/message-kind.vo';

const text = (body: string | null) => classifyInbound({ body, kind: MessageKind.TEXT });

describe('classifyInbound — opt-out comes first', () => {
  it.each(['PARAR', 'sair', 'Cancelar', 'descadastrar', 'remover', 'quero sair', 'PARAR!!!'])(
    '%s is an opt-out and resolves itself',
    (body) => {
      const result = text(body);
      expect(result.intent).toBe(IntentClass.OPT_OUT);
      expect(result.autoResolvable).toBe(true);
    },
  );

  it('reuses the §6.5 detector, so a sentence containing the word is NOT an opt-out', () => {
    // Two lists of opt-out words that drift apart is a way to lose someone's request; this asserts
    // the classifier delegates instead of guessing again.
    expect(text('não quero parar de receber').intent).not.toBe(IntentClass.OPT_OUT);
    expect(text('vou cancelar meu plano de internet').intent).not.toBe(IntentClass.OPT_OUT);
  });
});

describe('classifyInbound — wrong number before complaint', () => {
  it.each([
    'número errado',
    'é engano',
    'não sou essa pessoa',
    'quem é você?',
    'não conheço',
    'pessoa errada',
  ])('%s is a wrong number', (body) => {
    const result = text(body);
    expect(result.intent).toBe(IntentClass.WRONG_NUMBER);
    // Out of routing, yes — but a human confirms it. "quem é você?" is not hostility.
    expect(result.autoResolvable).toBe(false);
    expect(result.highPriority).toBe(false);
  });
});

describe('classifyInbound — complaints get the priority queue', () => {
  it.each([
    'isso é spam, vou denunciar',
    'quem te deu meu número?',
    'vou processar vocês',
    'meu advogado vai entrar em contato',
    'isso é um absurdo',
    'vou no PROCON',
    'invasão de privacidade, LGPD',
  ])('%s is a complaint with HIGH priority', (body) => {
    const result = text(body);
    expect(result.intent).toBe(IntentClass.COMPLAINT);
    expect(result.highPriority).toBe(true);
    // Never automatic: hostile content answered by a machine is how a bad day becomes a crisis.
    expect(result.autoResolvable).toBe(false);
  });

  it('a complaint wrapped in politeness is still a complaint', () => {
    // "obrigado, mas vou denunciar" must not be filed as an acknowledgement.
    expect(text('obrigado, mas vou denunciar isso').intent).toBe(IntentClass.COMPLAINT);
  });
});

describe('classifyInbound — acknowledgements close themselves without replying', () => {
  it.each(['ok', 'Obrigado', 'vlw', 'beleza', 'entendi', 'certo', 'amém', 'perfeito', 'sim'])(
    '%s is an acknowledgement',
    (body) => {
      const result = text(body);
      expect(result.intent).toBe(IntentClass.ACKNOWLEDGMENT);
      expect(result.autoResolvable).toBe(true);
    },
  );

  it('an acknowledgement with an emoji still counts', () => {
    expect(text('ok 👍').intent).toBe(IntentClass.ACKNOWLEDGMENT);
    expect(text('obrigada!!!').intent).toBe(IntentClass.ACKNOWLEDGMENT);
  });

  it('an acknowledgement followed by a real question is NOT auto-resolvable', () => {
    const result = text('ok, mas quando começa a obra da rua?');
    expect(result.intent).toBe(IntentClass.QUESTION);
    expect(result.autoResolvable).toBe(false);
  });
});

describe('classifyInbound — what reaches a human', () => {
  it.each([
    'quando vai ter atendimento?',
    'Qual o horário?',
    'como faço para participar',
    'pode me ajudar com uma coisa',
    'gostaria de saber sobre a creche',
  ])('%s is a question', (body) => {
    const result = text(body);
    expect(result.intent).toBe(IntentClass.QUESTION);
    expect(result.autoResolvable).toBe(false);
  });

  it('anything else is OTHER, and still goes to a human', () => {
    const result = text('meu vizinho jogou lixo na calçada de novo');
    expect(result.intent).toBe(IntentClass.OTHER);
    expect(result.autoResolvable).toBe(false);
  });

  it('an empty or null body needs a human, not a guess', () => {
    expect(text('').intent).toBe(IntentClass.OTHER);
    expect(text(null).intent).toBe(IntentClass.OTHER);
    expect(text('👍👍👍').intent).toBe(IntentClass.OTHER);
  });
});

describe('classifyInbound — media', () => {
  it('AUDIO is never auto-resolved: transcription is out of scope for v1 (§10.2 item 3)', () => {
    const result = classifyInbound({ body: null, kind: MessageKind.AUDIO });

    expect(result.intent).toBe(IntentClass.OTHER);
    expect(result.autoResolvable).toBe(false);
    expect(result.matchedRule).toBe('MEDIA_AUDIO');
  });

  it.each([MessageKind.IMAGE, MessageKind.VIDEO, MessageKind.DOCUMENT, MessageKind.STICKER])(
    '%s goes to a human',
    (kind) => {
      const result = classifyInbound({ body: 'ok', kind });
      // Even with a caption that looks like an acknowledgement: the media itself may be the message.
      expect(result.autoResolvable).toBe(false);
    },
  );
});

describe('classifyInbound — every result explains itself', () => {
  it('names the rule that fired, for the operator and for the trail', () => {
    expect(text('PARAR').matchedRule).toBe('OPT_OUT_KEYWORD');
    expect(text('é engano').matchedRule).toContain('WRONG_NUMBER');
    expect(text('vou denunciar').matchedRule).toContain('COMPLAINT');
    expect(text('ok').matchedRule).toBe('ACKNOWLEDGMENT');
    expect(text('quando?').matchedRule).toBe('QUESTION');
  });

  it('only opt-out and acknowledgement are auto-resolvable — §10.2 allows no others', () => {
    const bodies = [
      'PARAR',
      'ok',
      'é engano',
      'vou denunciar',
      'quando vai ter?',
      'qualquer outra coisa',
    ];
    const auto = bodies.filter((body) => text(body).autoResolvable);
    expect(auto).toEqual(['PARAR', 'ok']);
  });
});

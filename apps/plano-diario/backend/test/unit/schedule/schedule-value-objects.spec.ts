import { MessageTemplate } from '../../../src/contexts/schedule/domain/value-objects/message-template.vo';
import { SendTime } from '../../../src/contexts/schedule/domain/value-objects/send-time.vo';
import { Timezone } from '../../../src/contexts/schedule/domain/value-objects/timezone.vo';

describe('SendTime', () => {
  it.each([
    ['07:00', 7, 0, 420],
    ['00:00', 0, 0, 0],
    ['23:59', 23, 59, 1439],
  ])('aceita %s', (valor, hora, minuto, minutos) => {
    const t = SendTime.create(valor);
    expect([t.hour, t.minute, t.minutesOfDay]).toEqual([hora, minuto, minutos]);
    expect(t.value).toBe(valor);
  });

  it.each(['24:00', '7:00', '07:60', '0700', '', 'sete horas', '07:00:00'])(
    'recusa %s',
    (valor) => {
      expect(() => SendTime.create(valor)).toThrow(/Horário de envio inválido/);
    },
  );
});

describe('Timezone', () => {
  it.each(['America/Sao_Paulo', 'UTC', 'Europe/Lisbon', 'America/Manaus'])(
    'aceita fuso IANA %s',
    (tz) => {
      expect(Timezone.create(tz).value).toBe(tz);
    },
  );

  it('sem valor usa o default America/Sao_Paulo', () => {
    expect(Timezone.create().value).toBe('America/Sao_Paulo');
    expect(Timezone.create(null).value).toBe('America/Sao_Paulo');
  });

  it.each(['Brasil/SaoPaulo', 'GMT-3', 'inexistente', ''])('recusa %s', (tz) => {
    expect(() => Timezone.create(tz)).toThrow(/Fuso horário inválido/);
  });
});

describe('MessageTemplate', () => {
  it('default é data + url em duas linhas', () => {
    expect(MessageTemplate.create().value).toBe('{{date}}\n{{url}}');
  });

  it('renderiza exatamente o formato da spec', () => {
    const rendered = MessageTemplate.create().render({
      date: '28 de JULHO',
      url: 'https://youtu.be/aSi0uip5XHg',
    });
    expect(rendered).toBe('28 de JULHO\nhttps://youtu.be/aSi0uip5XHg');
    expect(rendered.split('\n')).toHaveLength(2);
  });

  it('RECUSA template sem {{url}} — a mensagem sem link não serve para nada', () => {
    expect(() => MessageTemplate.create('Bom dia! {{date}}')).toThrow(/precisa conter \{\{url\}\}/);
  });

  it('aceita template só com {{url}}', () => {
    expect(MessageTemplate.create('{{url}}').render({ date: 'x', url: 'U' })).toBe('U');
  });

  it('substitui múltiplas ocorrências', () => {
    expect(
      MessageTemplate.create('{{date}} — {{url}} ({{date}})').render({ date: 'D', url: 'U' }),
    ).toBe('D — U (D)');
  });

  it('normaliza CRLF para LF (o WhatsApp usa LF)', () => {
    expect(MessageTemplate.create('{{date}}\r\n{{url}}').value).toBe('{{date}}\n{{url}}');
  });

  it.each([['vazio', '   '], ['muito longo', 'x'.repeat(1001) + '{{url}}']])(
    'recusa template %s',
    (_caso, valor) => {
      expect(() => MessageTemplate.create(valor)).toThrow();
    },
  );

  it('não interpreta o conteúdo — placeholder desconhecido fica literal', () => {
    expect(MessageTemplate.create('{{url}} {{foo}}').render({ date: 'D', url: 'U' })).toBe(
      'U {{foo}}',
    );
  });
});

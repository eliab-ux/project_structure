import {
  buildReadingSequence,
  extractTitleDayNumber,
  SourceVideoInput,
} from '../../../src/contexts/catalog/domain/services/reading-sequence';

function video(
  titulo: string,
  videoId: string,
  publishedAt: string | null = null,
): SourceVideoInput {
  return {
    videoId,
    title: titulo,
    playlistId: 'UU-uploads',
    publishedAt: publishedAt ? new Date(publishedAt) : null,
  };
}

describe('extractTitleDayNumber', () => {
  it.each([
    ['Dia 208 - Isaías 26-28', 208],
    ['Plano de Leitura da Bíblia: Dia 01 - Gênesis 1-3', 1],
    ['Plano de Leitura: Dia 121- 2 Reis 8-9', 121],
    ['DIA 365 - Apocalipse 20-22', 365],
    ['dia  42 - qualquer', 42],
    // Os dias 96 e 97 do canal usam "Vídeo" em vez de "Dia" — sem isso, 1 Samuel 25-31
    // ficaria sem leitura no plano.
    ['Vídeo 96 - 1Sm 25-27', 96],
    ['Vídeo 97 - 1Sm 28-31', 97],
    ['video 100 - qualquer', 100],
  ])('extrai o número de "%s"', (titulo, esperado) => {
    expect(extractTitleDayNumber(titulo)).toBe(esperado);
  });

  it.each([
    'Culto de Gratidão pela Vida e Ministério do Pastor Harold Walker',
    'Leitura Bíblica - 05.01.2025',
    'A Importância de Saber que Deus é um Deus de Aliança I Leitura 2026 - 1',
    'Dias 96 e 97 - combinado',
  ])('não extrai número de "%s"', (titulo) => {
    expect(extractTitleDayNumber(titulo)).toBeNull();
  });
});

describe('buildReadingSequence', () => {
  it('numera a posição na ordem do título, ignorando o que não é leitura', () => {
    const sequence = buildReadingSequence([
      video('Dia 3 - Gênesis 8-11', 'v3'),
      video('Culto de Gratidão', 'sermao'),
      video('Dia 1 - Gênesis 1-3', 'v1'),
      video('Dia 2 - Gênesis 4-7', 'v2'),
    ]);

    expect(sequence.items.map((i) => [i.position, i.videoId])).toEqual([
      [1, 'v1'],
      [2, 'v2'],
      [3, 'v3'],
    ]);
    expect(sequence.skipped).toEqual([
      { videoId: 'sermao', title: 'Culto de Gratidão', reason: 'no-day-number' },
    ]);
  });

  it('descarta "material complementar" mesmo tendo número de dia', () => {
    const sequence = buildReadingSequence([
      video('Plano de Leitura da Bíblia: Dia 29 - Êxodo 32-34', 'real', '2020-02-20'),
      video(
        'Plano de Leitura da Bíblia: Dia 29 - Êxodo 32-34 - material complementar - O bezerro de ouro',
        'complementar',
        '2020-02-19',
      ),
    ]);

    expect(sequence.items).toHaveLength(1);
    expect(sequence.items[0].videoId).toBe('real');
    expect(sequence.skipped[0].reason).toBe('complementary-material');
  });

  it('mantém AMBOS os vídeos do dia 218 duplicado, na ordem de publicação', () => {
    // Caso real do canal: os dois foram leituras de dias consecutivos em 2020,
    // e é justamente por isso que a posição — não o número do título — é a chave.
    const sequence = buildReadingSequence([
      video('Dia 219 - Jeremias 4-6', 'v219', '2020-08-08'),
      video('Dia 218 - Jeremias 1-3', 'v218b', '2020-08-07'),
      video('Dia 217 - Isaías 60-63', 'v217', '2020-08-05'),
      video('Dia 218 - Isaías 64-66', 'v218a', '2020-08-06'),
    ]);

    expect(sequence.items.map((i) => [i.position, i.videoId])).toEqual([
      [1, 'v217'],
      [2, 'v218a'],
      [3, 'v218b'],
      [4, 'v219'],
    ]);
    expect(sequence.duplicates).toEqual([{ titleDayNumber: 218, videoIds: ['v218a', 'v218b'] }]);
  });

  it('reporta números de título ausentes sem abrir buraco na sequência', () => {
    const sequence = buildReadingSequence([
      video('Dia 95 - 1 Samuel 21-24', 'v95'),
      video('Dia 98 - 2 Samuel 1-3', 'v98'),
    ]);

    expect(sequence.missingTitleNumbers).toEqual([96, 97]);
    // As posições são contíguas: nenhum dia do ano fica sem vídeo por causa do furo.
    expect(sequence.items.map((i) => i.position)).toEqual([1, 2]);
  });

  it('deduplica o mesmo vídeo vindo de playlists diferentes', () => {
    const sequence = buildReadingSequence([
      { ...video('Dia 1 - Gênesis 1-3', 'v1'), playlistId: 'UU-uploads' },
      { ...video('Dia 1 - Gênesis 1-3', 'v1'), playlistId: 'PL-genesis' },
    ]);
    expect(sequence.items).toHaveLength(1);
  });

  it('vídeo sem data de publicação vai para o fim do empate', () => {
    const sequence = buildReadingSequence([
      video('Dia 5 - sem data', 'sem-data', null),
      video('Dia 5 - com data', 'com-data', '2020-03-01'),
    ]);
    expect(sequence.items.map((i) => i.videoId)).toEqual(['com-data', 'sem-data']);
  });

  it('canal vazio não quebra', () => {
    const sequence = buildReadingSequence([]);
    expect(sequence.items).toEqual([]);
    expect(sequence.missingTitleNumbers).toEqual([]);
    expect(sequence.duplicates).toEqual([]);
  });

  it('preserva o número do título para auditoria', () => {
    const sequence = buildReadingSequence([
      video('Dia 95 - 1 Samuel 21-24', 'v95'),
      video('Dia 98 - 2 Samuel 1-3', 'v98'),
    ]);
    expect(sequence.items[1]).toMatchObject({ position: 2, titleDayNumber: 98 });
  });
});

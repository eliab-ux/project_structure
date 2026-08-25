/**
 * Constrói a sequência de leituras do plano a partir dos vídeos crus do canal.
 *
 * Por que a posição na sequência — e não o número escrito no título — é a chave do dia:
 * o diagnóstico real do canal (28/07/2026) mostrou que a numeração dos títulos está furada.
 *   • os dias 96, 97 e 275 nunca existiram (números pulados pelo autor);
 *   • DOIS vídeos são "Dia 218" (Isaías 64-66 e Jeremias 1-3, publicados em dias consecutivos
 *     em 06 e 07/08/2020) — daí em diante todo título ficou 1 atrás do dia real;
 *   • vídeos "material complementar" repetem o número de um dia e não são leituras.
 *
 * Ordenar por `publishedAt` também não resolve: os primeiros dias subiram em lote
 * (9 vídeos em 07/04/2020). A ordem correta é o número do título, com empate desfeito
 * pela data de publicação — que é justamente o caso do 218.
 *
 * Módulo puro: nenhuma dependência de framework, HTTP ou banco.
 */

/** Vídeo como veio da fonte (YouTube), sem interpretação. */
export interface SourceVideoInput {
  videoId: string;
  title: string;
  playlistId: string;
  publishedAt: Date | null;
}

export interface ReadingSequenceItem {
  /** Posição na sequência (1…N). É esta a chave usada para resolver o dia do plano. */
  position: number;
  /** Número lido do título. Guardado para auditoria — detecta erro novo de numeração. */
  titleDayNumber: number;
  videoId: string;
  title: string;
  playlistId: string;
  publishedAt: Date | null;
}

export interface SkippedVideo {
  videoId: string;
  title: string;
  reason: 'no-day-number' | 'complementary-material';
}

export interface DuplicateTitleNumber {
  titleDayNumber: number;
  videoIds: string[];
}

export interface ReadingSequence {
  items: ReadingSequenceItem[];
  skipped: SkippedVideo[];
  /** Números de título usados por mais de um vídeo (todos entram na sequência). */
  duplicates: DuplicateTitleNumber[];
  /** Números de título ausentes dentro da faixa encontrada (o autor pulou). */
  missingTitleNumbers: number[];
}

/**
 * Extrai o número do dia do título.
 *
 * Aceita "Dia N" **e "Vídeo N"**: os dias 96 e 97 do canal foram publicados como
 * "Vídeo 96 - 1Sm 25-27" e "Vídeo 97 - 1Sm 28-31", e um regex que só olhasse "Dia" deixaria
 * 1 Samuel 25-31 fora do plano — sete capítulos sem leitura, incluindo a morte de Saul.
 * Foram os dois únicos casos em 526 vídeos, mas o padrão fica coberto.
 */
const DAY_NUMBER_RE = /\b(?:dia|v[íi]deo)\s*0*(\d{1,3})\b/i;
const COMPLEMENTARY_RE = /material\s+complementar/i;

export function extractTitleDayNumber(title: string): number | null {
  const match = DAY_NUMBER_RE.exec(title ?? '');
  return match ? Number(match[1]) : null;
}

export function isComplementaryMaterial(title: string): boolean {
  return COMPLEMENTARY_RE.test(title ?? '');
}

export function buildReadingSequence(videos: SourceVideoInput[]): ReadingSequence {
  const skipped: SkippedVideo[] = [];
  const readings: Array<SourceVideoInput & { titleDayNumber: number }> = [];
  const seenVideoIds = new Set<string>();

  for (const video of videos) {
    // A mesma leitura aparece na playlist de uploads e na playlist do livro — conta uma vez.
    if (seenVideoIds.has(video.videoId)) {
      continue;
    }
    seenVideoIds.add(video.videoId);

    if (isComplementaryMaterial(video.title)) {
      skipped.push({
        videoId: video.videoId,
        title: video.title,
        reason: 'complementary-material',
      });
      continue;
    }

    const titleDayNumber = extractTitleDayNumber(video.title);
    if (titleDayNumber === null) {
      skipped.push({ videoId: video.videoId, title: video.title, reason: 'no-day-number' });
      continue;
    }

    readings.push({ ...video, titleDayNumber });
  }

  readings.sort(
    (a, b) =>
      a.titleDayNumber - b.titleDayNumber ||
      publishedMillis(a.publishedAt) - publishedMillis(b.publishedAt) ||
      a.videoId.localeCompare(b.videoId),
  );

  const items: ReadingSequenceItem[] = readings.map((reading, index) => ({
    position: index + 1,
    titleDayNumber: reading.titleDayNumber,
    videoId: reading.videoId,
    title: reading.title,
    playlistId: reading.playlistId,
    publishedAt: reading.publishedAt,
  }));

  return {
    items,
    skipped,
    duplicates: findDuplicates(items),
    missingTitleNumbers: findMissing(items),
  };
}

function publishedMillis(publishedAt: Date | null): number {
  // Sem data de publicação vai para o fim do empate — nunca desloca quem tem data conhecida.
  return publishedAt ? publishedAt.getTime() : Number.MAX_SAFE_INTEGER;
}

function findDuplicates(items: ReadingSequenceItem[]): DuplicateTitleNumber[] {
  const byNumber = new Map<number, string[]>();
  for (const item of items) {
    const ids = byNumber.get(item.titleDayNumber) ?? [];
    ids.push(item.videoId);
    byNumber.set(item.titleDayNumber, ids);
  }
  return [...byNumber.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([titleDayNumber, videoIds]) => ({ titleDayNumber, videoIds }));
}

function findMissing(items: ReadingSequenceItem[]): number[] {
  if (items.length === 0) {
    return [];
  }
  const present = new Set(items.map((item) => item.titleDayNumber));
  const first = items[0].titleDayNumber;
  const last = items[items.length - 1].titleDayNumber;
  const missing: number[] = [];
  for (let n = first; n <= last; n += 1) {
    if (!present.has(n)) {
      missing.push(n);
    }
  }
  return missing;
}

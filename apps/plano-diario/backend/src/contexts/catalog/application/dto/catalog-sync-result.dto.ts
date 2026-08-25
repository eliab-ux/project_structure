export class CatalogSyncResultDto {
  /** Vídeos que entraram na sequência de leituras. */
  imported!: number;
  /** Dias criados nesta sync. */
  created!: number;
  /** Dias que já existiam e mudaram de conteúdo. */
  updated!: number;
  /** Vídeos do canal descartados (sem número de dia ou material complementar). */
  skipped!: number;
  /** Números de título usados por mais de um vídeo — problema na origem, registrado. */
  conflicts!: Array<{ titleDayNumber: number; videoIds: string[] }>;
  /** Números de título ausentes na faixa (o autor pulou). */
  missingTitleNumbers!: number[];
  firstDay!: number | null;
  lastDay!: number | null;
  syncedAt!: Date;
}

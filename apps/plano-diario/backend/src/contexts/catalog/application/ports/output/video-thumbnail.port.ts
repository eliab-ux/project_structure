export const VIDEO_THUMBNAIL = Symbol('VIDEO_THUMBNAIL');

export interface VideoThumbnail {
  /** Conteúdo da imagem em base64 puro — sem o prefixo `data:image/jpeg;base64,`. */
  base64: string;
  mimeType: string;
}

/**
 * Busca a miniatura de um vídeo.
 *
 * Existe porque a prévia do link no WhatsApp é montada por **quem envia**: o Baileys, dentro do
 * container da Evolution, teria que buscar a página do YouTube e baixar a imagem a partir do IP
 * do servidor — e quando isso falha ele engole o erro e manda texto puro, sem cartão. Buscando a
 * miniatura aqui, o envio vira uma imagem com legenda e a leitura sempre chega com o vídeo
 * visível.
 *
 * Contrato deliberado: `null` em vez de exceção. Miniatura é enfeite; a leitura do dia não pode
 * deixar de ser enviada porque uma imagem não baixou.
 */
export interface VideoThumbnailPort {
  fetch(videoId: string): Promise<VideoThumbnail | null>;
}

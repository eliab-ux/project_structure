import axios from 'axios';
import { YoutubeThumbnailAdapter } from '../../../src/infrastructure/youtube/youtube-thumbnail.adapter';

jest.mock('axios');

const get = jest.fn();
(axios.create as jest.Mock).mockReturnValue({ get });

/** Resposta do CDN com uma imagem plausível (o adapter exige ao menos 1 KB). */
function imagem(bytes = 2048, contentType = 'image/jpeg') {
  return { status: 200, headers: { 'content-type': contentType }, data: Buffer.alloc(bytes, 7) };
}

describe('YoutubeThumbnailAdapter', () => {
  let adapter: YoutubeThumbnailAdapter;

  beforeEach(() => {
    get.mockReset();
    adapter = new YoutubeThumbnailAdapter();
  });

  it('devolve a maior qualidade disponível, em base64', async () => {
    get.mockResolvedValue(imagem());

    const result = await adapter.fetch('Mr_WsXKXN30');

    expect(result?.mimeType).toBe('image/jpeg');
    expect(result?.base64).toBe(Buffer.alloc(2048, 7).toString('base64'));
    // Uma chamada só: a primeira qualidade serviu.
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toContain('maxresdefault.jpg');
  });

  it('cai para a próxima qualidade quando o CDN responde 404', async () => {
    // `maxresdefault` só existe para vídeo enviado em HD — 404 aqui é rotina, não erro.
    get
      .mockResolvedValueOnce({ status: 404, headers: {}, data: Buffer.alloc(0) })
      .mockResolvedValueOnce({ status: 404, headers: {}, data: Buffer.alloc(0) })
      .mockResolvedValueOnce(imagem());

    const result = await adapter.fetch('Mr_WsXKXN30');

    expect(result).not.toBeNull();
    expect(get).toHaveBeenCalledTimes(3);
    expect(get.mock.calls[2][0]).toContain('hqdefault.jpg');
  });

  it('resposta 200 que não é imagem é descartada', async () => {
    get.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: Buffer.alloc(4096),
    });

    expect(await adapter.fetch('Mr_WsXKXN30')).toBeNull();
  });

  it('imagem minúscula é descartada (placeholder do CDN)', async () => {
    get.mockResolvedValue(imagem(120));

    expect(await adapter.fetch('Mr_WsXKXN30')).toBeNull();
  });

  it('erro de rede devolve null — miniatura nunca derruba o envio', async () => {
    get.mockRejectedValue(new Error('ETIMEDOUT'));

    expect(await adapter.fetch('Mr_WsXKXN30')).toBeNull();
  });

  it('o videoId vai escapado na URL', async () => {
    get.mockResolvedValue(imagem());

    await adapter.fetch('../../etc/passwd');

    expect(get.mock.calls[0][0]).not.toContain('../');
  });
});

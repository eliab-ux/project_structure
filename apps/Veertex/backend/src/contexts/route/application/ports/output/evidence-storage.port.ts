export const EVIDENCE_STORAGE = Symbol('EVIDENCE_STORAGE');

/**
 * Storage das fotos de evidência (MinIO — §3.1 do 04, padrão do CLAUDE.md: base64 em JSON, chave do
 * objeto persistida, URL montada na leitura).
 *
 * ## Fronteira declarada — dependência `minio` não aprovada ainda
 * O cliente MinIO é uma DEPENDÊNCIA NOVA (gatilho de parada). Até a aprovação, o adapter é **no-op**:
 * devolve a chave determinística sem gravar o binário — o REGISTRO da evidência (linha com a chave)
 * já nasce, e o upload físico chega trocando o provider, sem migrar dados.
 */
export interface EvidenceStoragePort {
  /** Grava o binário e devolve a CHAVE do objeto (nunca a URL). */
  store(params: {
    accountId: string;
    orderId: string;
    kind: string;
    fileBase64: string;
    fileMimeType: string;
  }): Promise<string>;
}

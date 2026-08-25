import { DomainException } from '@gitspread/domain-primitives';

/**
 * Storage is not configured, and the operator needs to be told WHICH thing to configure.
 *
 * A `DomainException` rather than a plain `Error` on purpose. The GlobalExceptionFilter turns any
 * unexpected error into a generic 500 — correct, because a stack trace is not the client's business —
 * but here the cause is known, nameable and actionable, and hiding it made a contact import fail with
 * "Erro interno. Tente novamente." forever, since retrying a missing environment variable never helps.
 *
 * Same precedent as `RecoveryChannelUnavailableException`: a configuration gap that a human can close,
 * so it says so instead of pretending to be a transient fault.
 *
 * The message names the variables but no value — a secret never travels in an HTTP response.
 */
export class StorageNotConfiguredException extends DomainException {
  constructor() {
    super(
      'Armazenamento de arquivos não configurado. A importação guarda o arquivo original como ' +
        'prova de procedência da lista, então não há como importar sem ele. Defina MINIO_ENDPOINT, ' +
        'MINIO_ACCESS_KEY e MINIO_SECRET_KEY no ambiente do backend.',
    );
  }
}

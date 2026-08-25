export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface PutObjectInput {
  /** Tenant owning the object. ALWAYS taken from the JWT — never from body/query/header. */
  accountId: string;
  /** Path inside the account bucket, e.g. `contact-imports/<uuid>.csv`. */
  key: string;
  body: Buffer;
  mimeType: string;
}

export interface StoredObjectRef {
  bucket: string;
  key: string;
}

/**
 * Outbound port for binary storage (contact import files, content media, inbound media).
 * One bucket per account so a tenant's objects are physically separated.
 */
export interface FileStoragePort {
  putObject(input: PutObjectInput): Promise<StoredObjectRef>;
  /**
   * Reads an object back. Needed by the contact-import worker, which parses the file the request
   * stored — the file is the evidence of provenance, so it is read from storage rather than kept in
   * a job payload.
   */
  getObject(accountId: string, key: string): Promise<Buffer>;
  /**
   * Copies an object inside the SAME account bucket, server-side.
   *
   * Server-side matters: duplicating a content copies its media without the bytes ever passing
   * through this process, so a 20 MB video costs one API call instead of a download plus an upload.
   *
   * It exists because the alternative — two contents pointing at one storage key — makes deleting the
   * media of one silently break the other. A copy has its own key and its own lifetime.
   */
  copyObject(input: {
    accountId: string;
    sourceKey: string;
    destinationKey: string;
  }): Promise<StoredObjectRef>;

  /** Time-limited read URL. Objects are never public. */
  getSignedUrl(accountId: string, key: string, expiresInSeconds?: number): Promise<string>;
}

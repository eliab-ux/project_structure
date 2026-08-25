import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Envelope of an Evolution webhook call.
 *
 * Deliberately loose about `data`: the provider's payload shape varies by event and by version, and
 * declaring every variant would break on their next release. What IS strict:
 *
 *  - `instance` is a validated string, and it is the ONLY thing that decides which tenant this
 *    event belongs to (it is the namespaced name we generated). No field of `data` may select an
 *    account — otherwise the shared webhook token would be enough to write into any tenant.
 *  - `data` is only ever read through narrow, defensive accessors in the service, never spread into
 *    a domain object.
 *
 * `forbidNonWhitelisted` is global, so unknown top-level keys are rejected; the known-but-unused
 * ones are declared here to keep legitimate calls from being refused.
 */
export class EvolutionWebhookRequestDto {
  /** Event name, e.g. `connection.update`, `messages.upsert`. */
  @IsString()
  @MaxLength(100)
  event!: string;

  /** `acct-{account_id}-ch-{channel_id}`. The tenant is derived from this and nothing else. */
  @IsString()
  @MaxLength(120)
  instance!: string;

  /**
   * The provider's payload. Validated as "present or absent" and NOTHING else — on purpose.
   *
   * It used to carry `@IsObject()`, and that was a silent trap: class-validator's `isObject` REJECTS an
   * array, and Evolution has shipped `messages.upsert` with `data` as an array in some versions of the
   * v2 line (the same versioning drift that already changed the body of `/webhook/set` mid-series). A
   * rejected payload never reaches the service, so it produced no application log at all — a 400 answered
   * to the provider, which then quietly gives up. Indistinguishable from "nobody replied", and the exact
   * failure this endpoint must never have.
   *
   * The shape is not the DTO's business anyway: the service reads `data` only through narrow defensive
   * accessors and never spreads it into a domain object. Validating a provider's internal shape here buys
   * nothing and breaks on their next release.
   */
  @IsOptional()
  data?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apikey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  destination?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  date_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  server_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sender?: string;
}

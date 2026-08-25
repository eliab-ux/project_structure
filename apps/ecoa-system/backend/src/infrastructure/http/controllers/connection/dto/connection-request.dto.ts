import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConnectionCallbackRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code!: string;

  // Anti-CSRF nonce echoed back from GET /connection/oauth-url; the frontend verifies the
  // round-trip. Optional here so the backend never hard-fails on a client that omitted it.
  @IsOptional()
  @IsString()
  @MaxLength(128)
  state?: string;
}

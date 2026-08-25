export class AuthTokensDto {
  constructor(
    public readonly accessToken: string,
    public readonly refreshToken: string,
  ) {}
}

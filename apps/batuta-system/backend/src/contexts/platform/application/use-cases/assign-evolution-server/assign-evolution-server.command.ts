export class AssignEvolutionServerCommand {
  constructor(
    public readonly accountId: string,
    /** Both null → the tenant goes back to the shared platform server (§14, decisão 7). */
    public readonly serverUrl: string | null,
    public readonly apiKey: string | null,
    public readonly performedBy: string,
    public readonly ip: string | null,
  ) {}
}

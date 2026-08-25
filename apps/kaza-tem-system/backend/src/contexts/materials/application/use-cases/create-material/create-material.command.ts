export class CreateMaterialCommand {
  constructor(
    public readonly title: string,
    public readonly description: string,
    public readonly type: string,
    public readonly fileBuffer: Buffer,
    public readonly fileName: string,
    public readonly fileMimeType: string,
    public readonly thumbnailBuffer?: Buffer,
    public readonly thumbnailName?: string,
    public readonly thumbnailMimeType?: string,
  ) {}
}

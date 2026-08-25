import fs from "fs";
import { Request } from "express";
import busboy from "busboy";
import { v4 as uuid } from "uuid";

export default class UploadServices {
  public file: string;
  private id: string;
  private bus;
  private permitidos: Array<string>;

  constructor(request: Request) {
    this.id = uuid();
    this.bus = new busboy({ headers: request.headers });
    request.pipe(this.bus);
    this.permitidos = ["png", "jpg", "jpeg"];
  }

  async upload(file_path:string): Promise<void> {
    await this.bus.on(
      "file",
      async (fieldname, file, filename, encoding, mimetype) => {
        const file_type = mimetype.split("/");
        if (!this.permitidos.includes(file_type[file_type.length - 1])) {
          throw "Tipo de arquivo não permitido";
        }

        this.file = `${this.id}.${file_type[file_type.length - 1]}`;
        const fstream = fs.createWriteStream(`./public/uploads/${file_path}/${this.file}`);
        await file.pipe(fstream);
      }
    );
  }
}

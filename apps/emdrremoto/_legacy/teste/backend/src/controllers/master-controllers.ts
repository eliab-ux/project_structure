import { Response } from "express";
import validate from "../validator/request-valitator";
import UploadControllers from "./upload-controllers";

export default class MasterController {
  validator: any;
  request_fields: string[];
  repository: any;
  upload_path: string;
  constructor(repository) {
    this.validator = validate;
    this.request_fields = []; // * Valitade requested JSON fields
    this.repository = repository;
    this.upload_path = ""; // * Upload directory: /public/${this.upload_path}
  }

  /**
   *
   * @param req
   * @param res
   * @returns Promise
   */
  create = async (req, res): Promise<Response> => {
    if (!this.validator(req.body, this.request_fields))
      return res
        .status(400)
        .json({ message: "Todos os campos devem ser preenchidos." });

    const query_result = await this.repository.create(req.body);
    if (!query_result.created) return res.status(500).json(query_result);
    return res.status(201).json(query_result);
  };

  /**
   *
   * @param req
   * @param res
   * @returns Promise
   */
  read = async (req, res): Promise<Response> => {
    const all_data = await this.repository.read();

    return res.status(200).json(all_data);
  };

  readOne = async (req, res): Promise<Response> => {
    const all_data = await this.repository.readOne(req.params.id);

    return res.status(200).json(all_data);
  };

  update = async (req, res): Promise<Response> => {
    const updated_data: any = await this.repository.update(
      req.params.id,
      req.body
    );
    if (!updated_data.updated) return res.status(500).json(updated_data);

    return res.status(200).json(updated_data);
  };

  delete = async (req, res): Promise<Response> => {
    const deleted_data: any = await this.repository.delete(req.params.id);

    if (!deleted_data) return res.status(500).json(deleted_data);

    return res.status(200).json(deleted_data);
  };

  uploader = async (req): Promise<any> => {
    const upload_controller = new UploadControllers(this.upload_path);
    req.body.filename = req.params.filename;
    const upload_result: any = await upload_controller.uploadFile(req);
    return upload_result;
  };

  uploadFile = async (req, res): Promise<Response> => {
    const upload_result = await this.uploader(req);
    if (!upload_result.uploaded)
      return res.status(500).json({ uploaded: false });

    return res
      .status(200)
      .json({ uploaded: true, filename: upload_result.filename });
  };
}

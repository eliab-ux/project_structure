import UploadServices from "../services/upload-services";

export default class UploadControllers {
    private file_path:any
    constructor(file_path){
        this.file_path = file_path
    }
  uploadFile = async (request): Promise<Object> => {
    try {
      const upload_services: any = new UploadServices(request);
      await upload_services.upload(this.file_path);
    } catch (err) {
      return { uploaded: false, error: err };
    }
    return { uploaded: true };
  };
}

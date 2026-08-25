import controllers from "../controllers/init";
import MasterRoutes from "./master-routes";

export default class UploadRoutes extends MasterRoutes {
  constructor(controller: any) {
    super(controller);

    this.endpoints["upload-file"] = {
      upload_image: {
        endpont: this.router.post(
          `/perfil/:filename`,
          this.controller.uploadFile
        ),
      },
      upload_video: {
        endpont: this.router.post(
          `/video/:filename`,
          this.controller.uploadFile
        ),
      },
    };
  }
}

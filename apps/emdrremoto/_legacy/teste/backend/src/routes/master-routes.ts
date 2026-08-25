import * as express from "express";

export default class MasterRoutes {
  protected endpoints: Object;
  public router: any;
  public endpoint: string;
  protected controller: any;
  constructor(controller: any) {
    this.controller = controller;
    this.router = express.Router();
    this.endpoints = {
      create: {
        endpoint: this.router.post("/", this.controller.create),
      },
      read: {
        endpoint: this.router.get("/", this.controller.read),
      },
      readOne: {
        endpoint: this.router.get("/:id", this.controller.readOne),
      },
      update: {
        endpoint: this.router.put("/:id", this.controller.update),
      },
      delete: {
        endpoint: this.router.delete("/:id", this.controller.delete),
      },
    };

    this.endpoint = "";
  }
}

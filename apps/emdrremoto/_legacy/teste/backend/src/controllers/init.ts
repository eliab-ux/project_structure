const path = require("path");
const fs = require("fs");
const basename = path.basename(__filename);

let controllers:any = {};

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      (file.indexOf(".") !== 0 && file !== basename) && (file.endsWith(".js") || file.endsWith(".ts"))
    );
  })
  .forEach((file) => {
    const controller = require(path.join(__dirname, file));
    controllers[controller.default.name] = controller.default;
  });

export default controllers;

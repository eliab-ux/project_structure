const path = require("path");
const fs = require("fs");
const basename = path.basename(__filename);

let models: any = {};

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      (file.indexOf(".") !== 0 && file !== basename) && (file.endsWith(".js") || file.endsWith(".ts"))
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file));
    models[model.default.name] = model.default;
  });

export default models;

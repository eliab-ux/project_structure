const path = require("path");
const fs = require("fs");
const basename = path.basename(__filename);

let routes: any = {};

fs.readdirSync(__dirname).filter((file_path) => {
  if (!(file_path == "api" || file_path == "auth" || file_path == "core" )) {
    const current_path = fs.lstatSync(`${__dirname}/${file_path}`);
    if (current_path.isDirectory())
      fs.readdirSync(`${__dirname}/${file_path}`)
        .filter((router_file) => {
          return (
            (router_file.indexOf(".") !== 0 &&
            router_file !== basename) &&
            (router_file.endsWith(".js") || router_file.endsWith(".ts"))
          );
        })
        .forEach((file) => {
          const route = require(path.join(`${__dirname}/${file_path}`, file));
          const routeInstance = new route.default();
          let route_name = routeInstance.endpoint.replace("/", "");
          if (route_name == "") route_name = "index";
          routes[route_name] = {
            router: routeInstance.router,
            endpoint: routeInstance.endpoint,
          };
        });
  }
});

export default routes;

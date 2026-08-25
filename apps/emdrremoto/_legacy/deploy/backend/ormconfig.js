const dotenv = require("dotenv");
dotenv.config();

const sync = process.env.SYNC ? true : false;
console.log(`🔃 [database sync]: ${sync}`);

const logging = process.env.DATABASE_LOGGING ? true : false;
console.log(`🔃 [database logging]: ${logging}`);

const {
  DATABASE_HOST,
  DATABASE_PORT,
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_NAME,
  DATABASE_TYPE,
} = process.env;

module.exports = {
  name: "default",
  type: DATABASE_TYPE,
  host: DATABASE_HOST,
  port: DATABASE_PORT,
  username: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,
  synchronize: sync,
  logging: logging,
  entities: ["./build/models/**/*.js"],
  migrations: ["./build/migration/**/*.js"],
  subscribers: ["./build/subscriber/**/*.js"],
  cli: {
    entitiesDir: "./src/models",
    migrationsDir: "./src/migration",
    subscribersDir: "./src/subscriber",
  },
};

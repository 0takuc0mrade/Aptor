import { resolve } from "node:path";

import { DeliveryDatabase } from "../src/database.js";

const path =
  process.env.APTOR_DELIVERY_DB_PATH ??
  resolve(
    process.env.INIT_CWD ?? process.cwd(),
    ".aptor-delivery",
    "aptor.sqlite",
  );
const database = new DeliveryDatabase(path);
database.close();
console.info(`Aptor delivery database migrated at ${path}.`);

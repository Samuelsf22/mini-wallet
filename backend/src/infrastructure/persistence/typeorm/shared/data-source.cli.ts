import { readDatabaseConfig } from "../../../config/database.config.js";
import { createDataSource } from "./data-source.js";

export default createDataSource(readDatabaseConfig(process.env));

import { join } from "node:path";
import { DataSource } from "typeorm";
import type { DatabaseConfig } from "../../config/database.config.js";

export function createDataSource(config: DatabaseConfig): DataSource {
	return new DataSource({
		type: "postgres",
		host: config.host,
		port: config.port,
		username: config.username,
		password: config.password,
		database: config.database,
		synchronize: false,
		migrations: [join(__dirname, "migrations", "*.js")],
		migrationsTableName: "typeorm_migrations",
		migrationsTransactionMode: "all",
	});
}

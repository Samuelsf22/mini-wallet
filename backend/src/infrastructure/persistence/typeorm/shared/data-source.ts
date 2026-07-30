import { join } from "node:path";
import { DataSource } from "typeorm";
import type { DatabaseConfig } from "../../../config/database.config.js";
import { TransactionEntity } from "../transactions/transaction.entity.js";
import { TransferIdempotencyClaimEntity } from "../transactions/transfer-idempotency-claim.entity.js";
import { UserEntity } from "../users/user.entity.js";
import { WalletEntity } from "../wallets/wallet.entity.js";

export function createDataSource(config: DatabaseConfig): DataSource {
	return new DataSource({
		type: "postgres",
		host: config.host,
		port: config.port,
		username: config.username,
		password: config.password,
		database: config.database,
		synchronize: false,
		entities: [
			UserEntity,
			WalletEntity,
			TransactionEntity,
			TransferIdempotencyClaimEntity,
		],
		migrations: [join(__dirname, "..", "migrations", "*.js")],
		migrationsTableName: "typeorm_migrations",
		migrationsTransactionMode: "all",
	});
}

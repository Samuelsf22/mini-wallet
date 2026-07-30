import { describe, expect, it } from "vitest";
import { readDatabaseConfig } from "../../config/database.config.js";
import { InitialWalletSchema1710000000000 } from "../../persistence/typeorm/migrations/1710000000000-InitialWalletSchema.js";
import { createDataSource } from "../../persistence/typeorm/shared/data-source.js";

describe("database configuration", () => {
	it("validates a complete PostgreSQL configuration without connecting", () => {
		const config = readDatabaseConfig({
			DATABASE_HOST: "localhost",
			DATABASE_PORT: "5432",
			DATABASE_NAME: "mini_wallet",
			DATABASE_USER: "mini_wallet",
			DATABASE_PASSWORD: "secret",
		});

		expect(config).toEqual({
			host: "localhost",
			port: 5432,
			database: "mini_wallet",
			username: "mini_wallet",
			password: "secret",
		});
		expect(Object.isFrozen(config)).toBe(true);
	});

	it.each([undefined, "0", "65536", "postgres"])(
		"rejects an invalid database port: %j",
		(port) => {
			expect(() =>
				readDatabaseConfig({
					DATABASE_HOST: "localhost",
					DATABASE_PORT: port,
					DATABASE_NAME: "mini_wallet",
					DATABASE_USER: "mini_wallet",
					DATABASE_PASSWORD: "secret",
				}),
			).toThrow("DATABASE_PORT");
		},
	);

	it("creates a migration-owned datasource without initializing it", () => {
		const dataSource = createDataSource(
			readDatabaseConfig({
				DATABASE_HOST: "localhost",
				DATABASE_PORT: "5432",
				DATABASE_NAME: "mini_wallet",
				DATABASE_USER: "mini_wallet",
				DATABASE_PASSWORD: "secret",
			}),
		);

		expect(dataSource.isInitialized).toBe(false);
		expect(dataSource.options.synchronize).toBe(false);
		expect(dataSource.options.migrations).toHaveLength(1);
	});
});

describe("initial wallet migration", () => {
	it("creates and reverses the durable wallet schema", async () => {
		const executedSql: string[] = [];
		const queryRunner = {
			query: async (sql: string) => {
				executedSql.push(sql);
			},
		};
		const migration = new InitialWalletSchema1710000000000();

		await migration.up(queryRunner as never);
		expect(executedSql.join("\n")).toContain(
			"CREATE TABLE transfer_idempotency_claims",
		);
		expect(executedSql.join("\n")).toContain(
			"idempotency_key varchar(255) PRIMARY KEY",
		);
		expect(executedSql.join("\n")).toContain(
			"balance_minor_units BETWEEN 0 AND 9007199254740991",
		);
		const transactionsTable = executedSql.find((sql) =>
			sql.includes("CREATE TABLE transactions"),
		);
		expect(transactionsTable).toContain(
			"currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$')",
		);

		executedSql.length = 0;
		await migration.down(queryRunner as never);
		expect(executedSql).toEqual([
			"DROP TABLE transfer_idempotency_claims",
			"DROP TABLE transactions",
			"DROP TABLE wallets",
			"DROP TABLE users",
		]);
	});
});

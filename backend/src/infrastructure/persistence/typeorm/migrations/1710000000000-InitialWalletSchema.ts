import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialWalletSchema1710000000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE users (
				id uuid PRIMARY KEY,
				email varchar(320) NOT NULL UNIQUE,
				password_hash text NOT NULL,
				first_name varchar(255) NOT NULL,
				last_name varchar(255) NOT NULL,
				created_at timestamptz NOT NULL,
				updated_at timestamptz NOT NULL
			)
		`);
		await queryRunner.query(`
			CREATE TABLE wallets (
				id uuid PRIMARY KEY,
				user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
				balance_minor_units bigint NOT NULL CHECK (balance_minor_units BETWEEN 0 AND 9007199254740991),
				currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
				created_at timestamptz NOT NULL,
				updated_at timestamptz NOT NULL
			)
		`);
		await queryRunner.query(`
			CREATE TABLE transactions (
				id uuid PRIMARY KEY,
				wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
				type varchar(6) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
				amount_minor_units bigint NOT NULL CHECK (amount_minor_units BETWEEN 0 AND 9007199254740991),
				currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
				counterparty varchar(255),
				description text,
				reference varchar(255) NOT NULL,
				created_at timestamptz NOT NULL
			)
		`);
		await queryRunner.query(
			"CREATE INDEX transactions_wallet_id_created_at_idx ON transactions (wallet_id, created_at DESC)",
		);
		await queryRunner.query(
			"CREATE INDEX transactions_reference_idx ON transactions (reference)",
		);
		await queryRunner.query(`
			CREATE TABLE transfer_idempotency_claims (
				idempotency_key varchar(255) PRIMARY KEY,
				source_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
				recipient_email varchar(320) NOT NULL,
				request_amount_minor_units bigint NOT NULL CHECK (request_amount_minor_units BETWEEN 1 AND 9007199254740991),
				request_description text,
				status varchar(16) NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
				resolved_source_wallet_id uuid REFERENCES wallets(id) ON DELETE RESTRICT,
				resolved_target_wallet_id uuid REFERENCES wallets(id) ON DELETE RESTRICT,
				resolved_amount_minor_units bigint CHECK (resolved_amount_minor_units BETWEEN 1 AND 9007199254740991),
				resolved_currency varchar(3) CHECK (resolved_currency ~ '^[A-Z]{3}$'),
				resolved_description text,
				debit_transaction_id uuid REFERENCES transactions(id) ON DELETE RESTRICT,
				credit_transaction_id uuid REFERENCES transactions(id) ON DELETE RESTRICT,
				replay_balance_minor_units bigint CHECK (replay_balance_minor_units BETWEEN 0 AND 9007199254740991),
				created_at timestamptz NOT NULL,
				completed_at timestamptz,
				CHECK (
					(status = 'IN_PROGRESS' AND resolved_source_wallet_id IS NULL AND resolved_target_wallet_id IS NULL AND resolved_amount_minor_units IS NULL AND resolved_currency IS NULL AND debit_transaction_id IS NULL AND credit_transaction_id IS NULL AND replay_balance_minor_units IS NULL AND completed_at IS NULL)
					OR
					(status = 'COMPLETED' AND resolved_source_wallet_id IS NOT NULL AND resolved_target_wallet_id IS NOT NULL AND resolved_amount_minor_units IS NOT NULL AND resolved_currency IS NOT NULL AND debit_transaction_id IS NOT NULL AND credit_transaction_id IS NOT NULL AND replay_balance_minor_units IS NOT NULL AND completed_at IS NOT NULL)
				)
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("DROP TABLE transfer_idempotency_claims");
		await queryRunner.query("DROP TABLE transactions");
		await queryRunner.query("DROP TABLE wallets");
		await queryRunner.query("DROP TABLE users");
	}
}

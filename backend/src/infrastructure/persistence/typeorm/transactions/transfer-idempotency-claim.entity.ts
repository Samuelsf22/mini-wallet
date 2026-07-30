import { Column, Entity, PrimaryColumn } from "typeorm";

export const TransferClaimStatus = {
	IN_PROGRESS: "IN_PROGRESS",
	COMPLETED: "COMPLETED",
} as const;

@Entity({ name: "transfer_idempotency_claims" })
export class TransferIdempotencyClaimEntity {
	@PrimaryColumn({ name: "idempotency_key", type: "varchar", length: 255 })
	public idempotencyKey!: string;

	@Column({ name: "source_user_id", type: "uuid" })
	public sourceUserId!: string;

	@Column({ name: "recipient_email", type: "varchar", length: 320 })
	public recipientEmail!: string;

	@Column({ name: "request_amount_minor_units", type: "bigint" })
	public requestAmountMinorUnits!: string;

	@Column({ name: "request_description", type: "text", nullable: true })
	public requestDescription!: string | null;

	@Column({ type: "varchar", length: 16 })
	public status!: string;

	@Column({ name: "resolved_source_wallet_id", type: "uuid", nullable: true })
	public resolvedSourceWalletId!: string | null;

	@Column({ name: "resolved_target_wallet_id", type: "uuid", nullable: true })
	public resolvedTargetWalletId!: string | null;

	@Column({
		name: "resolved_amount_minor_units",
		type: "bigint",
		nullable: true,
	})
	public resolvedAmountMinorUnits!: string | null;

	@Column({
		name: "resolved_currency",
		type: "varchar",
		length: 3,
		nullable: true,
	})
	public resolvedCurrency!: string | null;

	@Column({ name: "resolved_description", type: "text", nullable: true })
	public resolvedDescription!: string | null;

	@Column({ name: "debit_transaction_id", type: "uuid", nullable: true })
	public debitTransactionId!: string | null;

	@Column({ name: "credit_transaction_id", type: "uuid", nullable: true })
	public creditTransactionId!: string | null;

	@Column({
		name: "replay_balance_minor_units",
		type: "bigint",
		nullable: true,
	})
	public replayBalanceMinorUnits!: string | null;

	@Column({ name: "created_at", type: "timestamptz" })
	public createdAt!: Date;

	@Column({ name: "completed_at", type: "timestamptz", nullable: true })
	public completedAt!: Date | null;
}

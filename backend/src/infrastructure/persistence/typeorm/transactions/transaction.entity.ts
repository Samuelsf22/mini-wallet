import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "transactions" })
export class TransactionEntity {
	@PrimaryColumn("uuid")
	public id!: string;

	@Column({ name: "wallet_id", type: "uuid" })
	public walletId!: string;

	@Column({ type: "varchar", length: 6 })
	public type!: string;

	@Column({ name: "amount_minor_units", type: "bigint" })
	public amountMinorUnits!: string;

	@Column({ type: "varchar", length: 3 })
	public currency!: string;

	@Column({ type: "varchar", length: 255, nullable: true })
	public counterparty!: string | null;

	@Column({ type: "text", nullable: true })
	public description!: string | null;

	@Column({ type: "varchar", length: 255 })
	public reference!: string;

	@Column({ name: "created_at", type: "timestamptz" })
	public createdAt!: Date;
}

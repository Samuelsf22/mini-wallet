import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "wallets" })
export class WalletEntity {
	@PrimaryColumn("uuid")
	public id!: string;

	@Column({ name: "user_id", type: "uuid", unique: true })
	public userId!: string;

	@Column({ name: "balance_minor_units", type: "bigint" })
	public balanceMinorUnits!: string;

	@Column({ type: "varchar", length: 3 })
	public currency!: string;

	@Column({ name: "created_at", type: "timestamptz" })
	public createdAt!: Date;

	@Column({ name: "updated_at", type: "timestamptz" })
	public updatedAt!: Date;
}

import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "users" })
export class UserEntity {
	@PrimaryColumn("uuid")
	public id!: string;

	@Column({ type: "varchar", length: 320, unique: true })
	public email!: string;

	@Column({ name: "password_hash", type: "text" })
	public passwordHash!: string;

	@Column({ name: "first_name", type: "varchar", length: 255 })
	public firstName!: string;

	@Column({ name: "last_name", type: "varchar", length: 255 })
	public lastName!: string;

	@Column({ name: "created_at", type: "timestamptz" })
	public createdAt!: Date;

	@Column({ name: "updated_at", type: "timestamptz" })
	public updatedAt!: Date;
}

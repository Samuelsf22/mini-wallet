import type { EntityManager } from "typeorm";
import type { UserRepository } from "../../../../modules/users/application/ports/user-repository.js";
import type { User } from "../../../../modules/users/domain/entities/user.js";
import type { Email } from "../../../../modules/users/domain/value-objects/email.js";
import { ApplicationError } from "../../../../shared/application/errors/application.errors.js";
import { UserEntity } from "./user.entity.js";
import { toDomainUser, toUserEntity } from "./user.mapper.js";

export class TypeormUserRepository implements UserRepository {
	public constructor(private readonly manager: EntityManager) {}

	public async findByEmail(email: Email): Promise<User | undefined> {
		const entity = await this.manager.getRepository(UserEntity).findOneBy({
			email: email.value,
		});
		return entity === null ? undefined : toDomainUser(entity);
	}

	public async save(user: User): Promise<void> {
		try {
			await this.manager.getRepository(UserEntity).save(toUserEntity(user));
		} catch (error) {
			if (isUsersEmailUniqueViolation(error)) {
				throw ApplicationError.emailAlreadyInUse(user.email.value);
			}
			throw error;
		}
	}
}

function isUsersEmailUniqueViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const candidate = error as { code?: unknown; constraint?: unknown };
	return (
		candidate.code === "23505" && candidate.constraint === "users_email_key"
	);
}

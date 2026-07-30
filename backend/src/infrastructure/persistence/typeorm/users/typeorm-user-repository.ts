import type { EntityManager } from "typeorm";
import type { UserRepository } from "../../../../modules/users/application/ports/user-repository.js";
import type { User } from "../../../../modules/users/domain/entities/user.js";
import type { Email } from "../../../../modules/users/domain/value-objects/email.js";
import { UserEntity } from "./user.entity.js";
import { toDomainUser } from "./user.mapper.js";

export class TypeormUserRepository implements UserRepository {
	public constructor(private readonly manager: EntityManager) {}

	public async findByEmail(email: Email): Promise<User | undefined> {
		const entity = await this.manager.getRepository(UserEntity).findOneBy({
			email: email.value,
		});
		return entity === null ? undefined : toDomainUser(entity);
	}
}

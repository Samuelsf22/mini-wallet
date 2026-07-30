import { User } from "../../../../modules/users/domain/entities/user.js";
import { Email } from "../../../../modules/users/domain/value-objects/email.js";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import type { UserEntity } from "./user.entity.js";

export function toDomainUser(entity: UserEntity): User {
	return new User({
		id: Uuid.of(entity.id),
		email: Email.of(entity.email),
		passwordHash: entity.passwordHash,
		firstName: entity.firstName,
		lastName: entity.lastName,
		createdAt: entity.createdAt,
		updatedAt: entity.updatedAt,
	});
}

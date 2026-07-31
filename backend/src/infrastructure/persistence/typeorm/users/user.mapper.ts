import { User } from "../../../../modules/users/domain/entities/user.js";
import { Email } from "../../../../modules/users/domain/value-objects/email.js";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import { UserEntity } from "./user.entity.js";

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

export function toUserEntity(user: User): UserEntity {
	return Object.assign(new UserEntity(), {
		id: user.id.value,
		email: user.email.value,
		passwordHash: user.passwordHash,
		firstName: user.firstName,
		lastName: user.lastName,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	});
}

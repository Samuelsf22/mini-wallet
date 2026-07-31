import type { User } from "../domain/entities/user.js";

export interface AuthenticationUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
}

export function toAuthenticationUser(user: User): AuthenticationUser {
	return {
		id: user.id.value,
		email: user.email.value,
		firstName: user.firstName,
		lastName: user.lastName,
	};
}

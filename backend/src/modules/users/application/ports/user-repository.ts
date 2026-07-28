import type { User } from "../../domain/entities/user.js";
import type { Email } from "../../domain/value-objects/email.js";

export interface UserRepository {
	findByEmail(email: Email): Promise<User | undefined>;
}

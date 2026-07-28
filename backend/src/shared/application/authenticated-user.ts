import type { Uuid } from "../domain/value-objects/uuid.js";

export interface AuthenticatedUser {
	userId: Uuid;
}

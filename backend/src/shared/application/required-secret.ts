import { ApplicationError } from "./errors/application.errors.js";

export function requiredSecret(field: string, value: unknown): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw ApplicationError.invalidSecretInput(field);
	}

	return value;
}

import { ApplicationError } from "./errors/application.errors.js";

export function requiredText(field: string, value: unknown): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw ApplicationError.invalidInput(field, value);
	}

	return value.trim();
}

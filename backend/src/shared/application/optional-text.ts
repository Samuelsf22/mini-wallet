import { ApplicationError } from "./errors/application.errors.js";

export function optionalText(
	field: string,
	value: unknown,
): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "string") {
		throw ApplicationError.invalidInput(field, value);
	}

	return value.trim() || undefined;
}

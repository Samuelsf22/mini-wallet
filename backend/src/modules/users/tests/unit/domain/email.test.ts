import { describe, expect, it } from "vitest";

import { UserError } from "../../../domain/errors/user.errors.js";
import { Email } from "../../../domain/value-objects/email.js";

const expectInvalidEmail = (value: unknown): void => {
	let error: unknown;

	try {
		Email.of(value as string);
	} catch (caughtError) {
		error = caughtError;
	}

	expect(error).toBeInstanceOf(UserError);
	expect(error).toMatchObject({ code: "INVALID_EMAIL" });
	expect((error as UserError).details).toEqual({ value });
};

describe("Email", () => {
	it("creates an immutable valid email", () => {
		const email = Email.of("alice@example.com");

		expect(email.value).toBe("alice@example.com");
		expect(email.toString()).toBe("alice@example.com");
		expect(Object.isFrozen(email)).toBe(true);
	});

	it.each([
		"",
		"alice",
		"alice@",
		"@example.com",
		"alice @example.com",
		"alice@.com",
		"alice@example..com",
	])("rejects invalid email addresses: %j", (value) => {
		expectInvalidEmail(value);
	});

	it("rejects non-string runtime inputs with the invalid-email contract", () => {
		expectInvalidEmail(42);
	});

	it("trims and lowercases values for transfer lookups", () => {
		const email = Email.of("  ALICE@Example.COM  ");

		expect(email.value).toBe("alice@example.com");
		expect(email.equals(Email.of("alice@example.com"))).toBe(true);
	});
});

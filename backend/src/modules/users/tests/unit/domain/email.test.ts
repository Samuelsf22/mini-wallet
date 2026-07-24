import { describe, expect, it } from "vitest";

import { InvalidEmailError } from "../../../domain/errors/user.errors.js";
import { Email } from "../../../domain/value-objects/email.js";

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
		expect(() => Email.of(value)).toThrow(InvalidEmailError);
	});

	it("trims and lowercases values for transfer lookups", () => {
		const email = Email.of("  ALICE@Example.COM  ");

		expect(email.value).toBe("alice@example.com");
		expect(email.equals(Email.of("alice@example.com"))).toBe(true);
	});
});

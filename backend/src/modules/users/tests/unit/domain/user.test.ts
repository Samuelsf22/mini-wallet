import { describe, expect, it } from "vitest";

import { Uuid } from "../../../../../shared/domain/value-objects/uuid.js";
import { User } from "../../../domain/entities/user.js";
import {
	InvalidPasswordHashError,
	InvalidUserDateError,
	InvalidUserNameError,
} from "../../../domain/errors/user.errors.js";
import { Email } from "../../../domain/value-objects/email.js";

const userId = "0e4a98b5-b77f-4cf6-bf76-258de3ac5124";

function createUser(
	overrides: Partial<ConstructorParameters<typeof User>[0]> = {},
) {
	return new User({
		id: Uuid.of(userId),
		email: Email.of("alice@example.com"),
		passwordHash: "$argon2id$v=19$example",
		firstName: "Alice",
		lastName: "Doe",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	});
}

describe("User", () => {
	it("preserves its identity, email, opaque password hash, and normalized names", () => {
		const id = Uuid.of(userId);
		const email = Email.of("alice@example.com");
		const passwordHash = "$argon2id$v=19$example";

		const user = new User({
			id,
			email,
			passwordHash,
			firstName: " Alice ",
			lastName: " Doe ",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		});

		expect(user.id).toBe(id);
		expect(user.email).toBe(email);
		expect(user.passwordHash).toBe(passwordHash);
		expect(user.firstName).toBe("Alice");
		expect(user.lastName).toBe("Doe");
		expect(user.fullName).toBe("Alice Doe");
	});

	it("requires non-empty first and last names", () => {
		expect(() => createUser({ firstName: "  " })).toThrow(InvalidUserNameError);
		expect(() => createUser({ lastName: "" })).toThrow(InvalidUserNameError);
	});

	it("requires a non-empty password hash", () => {
		expect(() => createUser({ passwordHash: "  " })).toThrow(
			InvalidPasswordHashError,
		);
	});

	it("rejects invalid dates and protects its dates from external mutation", () => {
		expect(() => createUser({ createdAt: new Date("invalid") })).toThrow(
			InvalidUserDateError,
		);
		expect(() =>
			createUser({ updatedAt: "2026-01-01" as unknown as Date }),
		).toThrow(InvalidUserDateError);

		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const user = createUser({ createdAt });
		createdAt.setFullYear(2030);

		const exposedCreatedAt = user.createdAt;
		exposedCreatedAt.setFullYear(2030);
		const exposedUpdatedAt = user.updatedAt;
		exposedUpdatedAt.setFullYear(2030);

		expect(user.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
		expect(user.updatedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
	});

	it("leaves all observable state unchanged when the email change date is invalid", () => {
		const user = createUser();
		const originalState = {
			id: user.id,
			email: user.email,
			passwordHash: user.passwordHash,
			firstName: user.firstName,
			lastName: user.lastName,
			fullName: user.fullName,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		};

		expect(() =>
			user.changeEmail(
				Email.of("new-address@example.com"),
				new Date("invalid"),
			),
		).toThrow(InvalidUserDateError);

		expect(user.id).toBe(originalState.id);
		expect(user.email).toBe(originalState.email);
		expect(user.passwordHash).toBe(originalState.passwordHash);
		expect(user.firstName).toBe(originalState.firstName);
		expect(user.lastName).toBe(originalState.lastName);
		expect(user.fullName).toBe(originalState.fullName);
		expect(user.createdAt).toEqual(originalState.createdAt);
		expect(user.updatedAt).toEqual(originalState.updatedAt);
	});

	it("changes its email and updatedAt without changing identity, password hash, names, or createdAt", () => {
		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const user = createUser({ createdAt, updatedAt: createdAt });
		const changedAt = new Date("2026-02-01T00:00:00.000Z");

		user.changeEmail(Email.of("new-address@example.com"), changedAt);
		changedAt.setFullYear(2030);

		expect(user.id).toEqual(Uuid.of(userId));
		expect(user.email).toEqual(Email.of("new-address@example.com"));
		expect(user.passwordHash).toBe("$argon2id$v=19$example");
		expect(user.firstName).toBe("Alice");
		expect(user.lastName).toBe("Doe");
		expect(user.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
		expect(user.updatedAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
	});
});

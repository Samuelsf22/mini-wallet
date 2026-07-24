import { describe, expect, it } from "vitest";

import { Uuid } from "../../../../../shared/domain/value-objects/uuid.js";
import { User } from "../../../domain/entities/user.js";
import { UserError } from "../../../domain/errors/user.errors.js";
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

function expectUserError(
	action: () => unknown,
	code: UserError["code"],
	details: NonNullable<UserError["details"]>,
): void {
	let error: unknown;

	try {
		action();
	} catch (caughtError) {
		error = caughtError;
	}

	expect(error).toBeInstanceOf(UserError);
	expect(error).toMatchObject({ code, details });
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

	it.each([
		{ field: "firstName", value: "  " },
		{ field: "lastName", value: "" },
	] as const)(
		"reports the exact invalid-name contract for $field",
		({ field, value }) => {
			expectUserError(() => createUser({ [field]: value }), "INVALID_NAME", {
				field,
				value,
			});
		},
	);

	it("reports a stable code and safe context for an invalid password hash", () => {
		const passwordHash = "  ";
		let error: unknown;

		try {
			createUser({ passwordHash });
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(UserError);
		expect(error).toHaveProperty("code", "INVALID_PASSWORD_HASH");
		expect(error).toHaveProperty("details", { field: "passwordHash" });
		expect(error).not.toHaveProperty("details.value");
		expect(JSON.stringify(error)).not.toContain(passwordHash);
	});

	it("reports the exact safe error contract for a non-string password hash", () => {
		expectUserError(
			() =>
				createUser({
					passwordHash: 123,
				} as unknown as Partial<ConstructorParameters<typeof User>[0]>),
			"INVALID_PASSWORD_HASH",
			{ field: "passwordHash" },
		);
	});

	it.each([
		{ field: "firstName", value: 123 },
		{ field: "lastName", value: false },
	] as const)(
		"reports the exact invalid-name contract for a non-string $field",
		({ field, value }) => {
			expectUserError(
				() =>
					createUser({ [field]: value } as unknown as Partial<
						ConstructorParameters<typeof User>[0]
					>),
				"INVALID_NAME",
				{ field, value },
			);
		},
	);

	it("reports a stable code and field context for invalid dates", () => {
		const invalidCreatedAt = new Date("invalid");
		let error: unknown;

		try {
			createUser({ createdAt: invalidCreatedAt });
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(UserError);
		expect(error).toHaveProperty("code", "INVALID_DATE");
		expect(error).toHaveProperty("details", {
			field: "createdAt",
			value: invalidCreatedAt,
		});
	});

	it("reports the exact invalid updatedAt contract and protects dates from external mutation", () => {
		const invalidUpdatedAt = "2026-01-01" as unknown as Date;

		expectUserError(
			() => createUser({ updatedAt: invalidUpdatedAt }),
			"INVALID_DATE",
			{
				field: "updatedAt",
				value: invalidUpdatedAt,
			},
		);

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

		const invalidChangedAt = new Date("invalid");
		expectUserError(
			() =>
				user.changeEmail(Email.of("new-address@example.com"), invalidChangedAt),
			"INVALID_DATE",
			{ field: "updatedAt", value: invalidChangedAt },
		);

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

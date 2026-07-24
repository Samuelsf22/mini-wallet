import { describe, expect, it } from "vitest";

import { UuidError } from "../../../domain/errors/uuid.errors.js";
import { Uuid } from "../../../domain/value-objects/uuid.js";

const uuid = "6afc9fb6-8720-4e92-91d1-bc05ab978c78";

function expectUuidError(action: () => unknown, value: unknown): void {
	let error: unknown;

	try {
		action();
	} catch (caughtError) {
		error = caughtError;
	}

	expect(error).toBeInstanceOf(UuidError);
	expect(error).toMatchObject({
		code: "INVALID_UUID",
		details: { value },
	});
}

describe("Uuid", () => {
	it("creates an immutable canonical UUID", () => {
		const value = Uuid.of(uuid);

		expect(value.value).toBe(uuid);
		expect(value.toString()).toBe(uuid);
		expect(Object.isFrozen(value)).toBe(true);
	});

	it.each(["", "wallet-1", "6AFC9FB6-8720-4E92-91D1-BC05AB978C78"])(
		"rejects malformed UUIDs: %j",
		(value) => {
			expect(() => Uuid.of(value)).toThrow(UuidError);
		},
	);

	it("exposes a stable code and the rejected value", () => {
		let error: unknown;

		try {
			Uuid.of("wallet-1");
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toMatchObject({
			code: "INVALID_UUID",
			details: { value: "wallet-1" },
		});
	});

	it("reports the exact error contract for a non-string value", () => {
		const value = 123;

		expectUuidError(() => Uuid.of(value as unknown as string), value);
	});

	it("compares values by UUID string", () => {
		expect(Uuid.of(uuid).equals(Uuid.of(uuid))).toBe(true);
	});
});

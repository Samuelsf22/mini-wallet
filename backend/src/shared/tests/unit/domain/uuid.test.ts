import { describe, expect, it } from "vitest";

import { InvalidUuidError } from "../../../domain/errors/uuid.errors.js";
import { Uuid } from "../../../domain/value-objects/uuid.js";

const uuid = "6afc9fb6-8720-4e92-91d1-bc05ab978c78";

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
			expect(() => Uuid.of(value)).toThrow(InvalidUuidError);
		},
	);

	it("compares values by UUID string", () => {
		expect(Uuid.of(uuid).equals(Uuid.of(uuid))).toBe(true);
	});
});

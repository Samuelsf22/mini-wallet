import { describe, expect, it } from "vitest";

import { InvalidUuidError } from "../../../domain/errors/uuid.errors.js";
import { UserId } from "../../../domain/value-objects/user-id.js";

const userUuid = "0e4a98b5-b77f-4cf6-bf76-258de3ac5124";

describe("UserId", () => {
	it("creates an immutable identifier", () => {
		const id = UserId.of(userUuid);

		expect(id.value).toBe(userUuid);
		expect(id.toString()).toBe(userUuid);
		expect(Object.isFrozen(id)).toBe(true);
	});

	it.each(["", "user-1", "0E4A98B5-B77F-4CF6-BF76-258DE3AC5124"])(
		"rejects malformed UUID identifiers: %j",
		(value) => {
			expect(() => UserId.of(value)).toThrow(InvalidUuidError);
		},
	);

	it("compares identifiers with the same UUID value", () => {
		expect(UserId.of(userUuid).equals(UserId.of(userUuid))).toBe(true);
	});
});

import { describe, expect, it } from "vitest";

import { InvalidTimestampError } from "../../../domain/errors/timestamp.errors.js";
import { Timestamp } from "../../../domain/value-objects/timestamp.js";

describe("Timestamp", () => {
	it("copies dates on construction and retrieval", () => {
		const input = new Date("2026-07-24T08:00:00.000Z");
		const timestamp = Timestamp.from(input);
		input.setUTCFullYear(2030);

		expect(timestamp.toDate()).toEqual(new Date("2026-07-24T08:00:00.000Z"));
		const exposedDate = timestamp.toDate();
		exposedDate.setUTCFullYear(2030);
		expect(timestamp.toDate()).toEqual(new Date("2026-07-24T08:00:00.000Z"));
		expect(Object.isFrozen(timestamp)).toBe(true);
	});

	it("rejects invalid dates with a typed domain error", () => {
		expect(() => Timestamp.from(new Date("invalid"))).toThrow(
			InvalidTimestampError,
		);
	});

	it("can be deterministically created from an injected clock", () => {
		const timestamp = Timestamp.now(() => new Date("2026-07-24T08:00:00.000Z"));

		expect(timestamp.toDate()).toEqual(new Date("2026-07-24T08:00:00.000Z"));
	});
});

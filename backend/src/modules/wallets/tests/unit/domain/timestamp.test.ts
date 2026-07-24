import { describe, expect, it } from "vitest";

import { WalletError } from "../../../domain/errors/wallet.errors.js";
import { Timestamp } from "../../../domain/value-objects/timestamp.js";

function expectTimestampError(action: () => unknown, value: unknown): void {
	let error: unknown;

	try {
		action();
	} catch (caughtError) {
		error = caughtError;
	}

	expect(error).toBeInstanceOf(WalletError);
	expect(error).toMatchObject({
		code: "INVALID_TIMESTAMP",
		details: { value },
	});
}

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
		expect(() => Timestamp.from(new Date("invalid"))).toThrow(WalletError);
	});

	it("exposes a timestamp-specific code and the rejected value", () => {
		let error: unknown;

		try {
			Timestamp.from(new Date("invalid"));
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toMatchObject({
			code: "INVALID_TIMESTAMP",
			details: { value: expect.any(Date) },
		});
	});

	it("reports the exact error contract for a non-Date value", () => {
		const value = "2026-07-24T08:00:00.000Z";

		expectTimestampError(() => Timestamp.from(value as unknown as Date), value);
	});

	it("can be deterministically created from an injected clock", () => {
		const timestamp = Timestamp.now(() => new Date("2026-07-24T08:00:00.000Z"));

		expect(timestamp.toDate()).toEqual(new Date("2026-07-24T08:00:00.000Z"));
	});
});

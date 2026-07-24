import { describe, expect, it } from "vitest";

import { InvalidUuidError } from "../../../domain/errors/uuid.errors.js";
import { WalletId } from "../../../domain/value-objects/wallet-id.js";

const walletUuid = "6afc9fb6-8720-4e92-91d1-bc05ab978c78";

describe("WalletId", () => {
	it("creates an immutable identifier", () => {
		const id = WalletId.of(walletUuid);

		expect(id.value).toBe(walletUuid);
		expect(id.toString()).toBe(walletUuid);
		expect(Object.isFrozen(id)).toBe(true);
	});

	it.each(["", "wallet-1", "6AFC9FB6-8720-4E92-91D1-BC05AB978C78"])(
		"rejects malformed UUID identifiers: %j",
		(value) => {
			expect(() => WalletId.of(value)).toThrow(InvalidUuidError);
		},
	);

	it("compares identifiers with the same UUID value", () => {
		expect(WalletId.of(walletUuid).equals(WalletId.of(walletUuid))).toBe(true);
	});
});

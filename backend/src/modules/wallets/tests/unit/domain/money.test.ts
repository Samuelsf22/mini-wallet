import { describe, expect, it } from "vitest";

import {
	CurrencyMismatchError,
	InsufficientFundsError,
	InvalidMoneyError,
	MoneyOverflowError,
} from "../../../domain/errors/money.errors.js";
import { Money } from "../../../domain/value-objects/money.js";

describe("Money", () => {
	it("creates an immutable zero-valued amount in minor units", () => {
		const money = Money.of(0, "USD");

		expect(money.minorUnits).toBe(0);
		expect(money.currency).toBe("USD");
		expect(Object.isFrozen(money)).toBe(true);
	});

	it.each([
		-1,
		1.5,
		Number.POSITIVE_INFINITY,
		Number.NaN,
		Number.MAX_SAFE_INTEGER + 1,
	])("rejects invalid minor units: %s", (minorUnits) => {
		expect(() => Money.of(minorUnits, "USD")).toThrow(InvalidMoneyError);
	});

	it("includes invalid money input in its typed error context", () => {
		let error: unknown;

		try {
			Money.of(Number.NaN, "USD");
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(InvalidMoneyError);
		expect(error).toMatchObject({
			reason: "minor units must be a non-negative safe integer",
			context: { currency: "USD", minorUnits: Number.NaN },
		});
		expect(error).toHaveProperty(
			"message",
			expect.stringContaining("minorUnits=NaN"),
		);
	});

	it.each(["usd", "US", "USDD", "12$"])(
		"rejects invalid currency code: %s",
		(currency) => {
			expect(() => Money.of(100, currency)).toThrow(InvalidMoneyError);
		},
	);

	it("adds and subtracts same-currency amounts without mutating either input", () => {
		const balance = Money.of(500, "USD");
		const deposit = Money.of(250, "USD");
		const withdrawal = Money.of(300, "USD");

		expect(balance.add(deposit)).toEqual(Money.of(750, "USD"));
		expect(balance.subtract(withdrawal)).toEqual(Money.of(200, "USD"));
		expect(balance).toEqual(Money.of(500, "USD"));
		expect(balance.equals(Money.of(500, "USD"))).toBe(true);
	});

	it("compares same-currency amounts for equality, less-than, and greater-than", () => {
		const balance = Money.of(500, "USD");

		expect(balance.compareTo(Money.of(500, "USD"))).toBe(0);
		expect(balance.compareTo(Money.of(501, "USD"))).toBeLessThan(0);
		expect(balance.compareTo(Money.of(499, "USD"))).toBeGreaterThan(0);
	});

	it("rejects arithmetic across currencies", () => {
		const usd = Money.of(500, "USD");
		const eur = Money.of(100, "EUR");

		expect(() => usd.add(eur)).toThrow(CurrencyMismatchError);
		expect(() => usd.subtract(eur)).toThrow(CurrencyMismatchError);
		expect(() => usd.compareTo(eur)).toThrow(CurrencyMismatchError);
	});

	it("includes both currency codes in a currency mismatch error", () => {
		let error: unknown;

		try {
			Money.of(500, "USD").add(Money.of(100, "EUR"));
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(CurrencyMismatchError);
		expect(error).toMatchObject({ expected: "USD", actual: "EUR" });
	});

	it("rejects subtraction that would make the amount negative", () => {
		const balance = Money.of(500, "USD");

		let error: unknown;

		try {
			balance.subtract(Money.of(501, "USD"));
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(InsufficientFundsError);
		expect(error).toMatchObject({
			availableMinorUnits: 500,
			requestedMinorUnits: 501,
		});
	});

	it("subtracts equal amounts to exactly zero", () => {
		expect(Money.of(500, "USD").subtract(Money.of(500, "USD"))).toEqual(
			Money.of(0, "USD"),
		);
	});

	it("rejects additions that would exceed the safe integer limit", () => {
		const maximum = Money.of(Number.MAX_SAFE_INTEGER, "USD");
		const one = Money.of(1, "USD");

		expect(() => maximum.add(one)).toThrow(MoneyOverflowError);
	});

	it("includes operands and currency in an arithmetic overflow error", () => {
		let error: unknown;

		try {
			Money.of(Number.MAX_SAFE_INTEGER, "USD").add(Money.of(1, "USD"));
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(MoneyOverflowError);
		expect(error).toMatchObject({
			leftMinorUnits: Number.MAX_SAFE_INTEGER,
			rightMinorUnits: 1,
			currency: "USD",
		});
	});
});

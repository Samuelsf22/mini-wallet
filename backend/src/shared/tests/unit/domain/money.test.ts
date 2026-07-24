import { describe, expect, it } from "vitest";

import { MoneyError } from "../../../domain/errors/money.errors.js";
import { Money } from "../../../domain/value-objects/money.js";

function expectMoneyError(
	action: () => unknown,
	code: MoneyError["code"],
	details: NonNullable<MoneyError["details"]>,
): void {
	let error: unknown;

	try {
		action();
	} catch (caughtError) {
		error = caughtError;
	}

	expect(error).toBeInstanceOf(MoneyError);
	expect(error).toMatchObject({ code, details });
}

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
		expectMoneyError(() => Money.of(minorUnits, "USD"), "INVALID_MINOR_UNITS", {
			minorUnits,
			currency: "USD",
		});
	});

	it.each([
		{
			name: "non-number minor units",
			minorUnits: "100" as unknown as number,
			currency: "USD",
			code: "INVALID_MINOR_UNITS" as const,
		},
		{
			name: "non-string currency",
			minorUnits: 100,
			currency: 123 as unknown as string,
			code: "INVALID_CURRENCY" as const,
		},
	])(
		"reports the exact error contract for $name",
		({ minorUnits, currency, code }) => {
			expectMoneyError(() => Money.of(minorUnits, currency), code, {
				minorUnits,
				currency,
			});
		},
	);

	it("includes invalid money input in its typed error context", () => {
		let error: unknown;

		try {
			Money.of(Number.NaN, "USD");
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(MoneyError);
		expect(error).toMatchObject({
			code: "INVALID_MINOR_UNITS",
			details: { currency: "USD", minorUnits: Number.NaN },
		});
		expect(error).toHaveProperty(
			"message",
			expect.stringContaining("minorUnits=NaN"),
		);
	});

	it.each(["usd", "US", "USDD", "12$"])(
		"reports the stable code and context for invalid currency code: %s",
		(currency) => {
			let error: unknown;

			try {
				Money.of(100, currency);
			} catch (caughtError) {
				error = caughtError;
			}

			expect(error).toBeInstanceOf(MoneyError);
			expect(error).toHaveProperty("code", "INVALID_CURRENCY");
			expect(error).toHaveProperty("details", { minorUnits: 100, currency });
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

	it.each([
		{ name: "addition", action: (usd: Money, eur: Money) => usd.add(eur) },
		{
			name: "subtraction",
			action: (usd: Money, eur: Money) => usd.subtract(eur),
		},
		{
			name: "comparison",
			action: (usd: Money, eur: Money) => usd.compareTo(eur),
		},
	])("reports the exact currency mismatch contract for $name", ({ action }) => {
		const usd = Money.of(500, "USD");
		const eur = Money.of(100, "EUR");

		expectMoneyError(() => action(usd, eur), "CURRENCY_MISMATCH", {
			expected: "USD",
			actual: "EUR",
		});
	});

	it("rejects subtraction that would make the amount negative", () => {
		const balance = Money.of(500, "USD");

		let error: unknown;

		try {
			balance.subtract(Money.of(501, "USD"));
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(MoneyError);
		expect(error).toMatchObject({
			code: "INSUFFICIENT_FUNDS",
			details: { availableMinorUnits: 500, requestedMinorUnits: 501 },
		});
	});

	it("subtracts equal amounts to exactly zero", () => {
		expect(Money.of(500, "USD").subtract(Money.of(500, "USD"))).toEqual(
			Money.of(0, "USD"),
		);
	});

	it("reports the exact arithmetic overflow contract", () => {
		expectMoneyError(
			() => Money.of(Number.MAX_SAFE_INTEGER, "USD").add(Money.of(1, "USD")),
			"AMOUNT_OVERFLOW",
			{
				leftMinorUnits: Number.MAX_SAFE_INTEGER,
				rightMinorUnits: 1,
				currency: "USD",
			},
		);
	});
});

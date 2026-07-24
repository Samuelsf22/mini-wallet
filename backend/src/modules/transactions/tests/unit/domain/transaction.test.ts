import { describe, expect, it } from "vitest";

import { Money } from "../../../../../shared/domain/value-objects/money.js";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.js";
import {
	Transaction,
	TransactionType,
} from "../../../domain/entities/transaction.js";
import { TransactionError } from "../../../domain/errors/transaction.errors.js";

function createTransaction(
	overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
) {
	return new Transaction({
		id: Uuid.of("0e4a98b5-b77f-4cf6-bf76-258de3ac5124"),
		walletId: Uuid.of("1157a7a6-0d91-4b0c-98ea-c4f6c0553832"),
		type: TransactionType.CREDIT,
		amount: Money.of(1500, "USD"),
		reference: "deposit-001",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	});
}

function expectTransactionError(
	action: () => unknown,
	code: TransactionError["code"],
	details: TransactionError["details"],
): void {
	let error: unknown;

	try {
		action();
	} catch (caughtError) {
		error = caughtError;
	}

	expect(error).toBeInstanceOf(TransactionError);
	expect(error).toMatchObject({ code, details });
}

describe("Transaction", () => {
	it("models a credit transaction", () => {
		const transaction = createTransaction({
			counterparty: " Employer ",
			description: " January salary ",
			reference: " salary-001 ",
		});

		expect(transaction.type).toBe(TransactionType.CREDIT);
		expect(transaction.amount).toEqual(Money.of(1500, "USD"));
		expect(transaction.counterparty).toBe("Employer");
		expect(transaction.description).toBe("January salary");
		expect(transaction.reference).toBe("salary-001");
	});

	it("models a debit transaction", () => {
		const transaction = createTransaction({ type: TransactionType.DEBIT });

		expect(transaction.type).toBe(TransactionType.DEBIT);
		expect(transaction.walletId).toEqual(
			Uuid.of("1157a7a6-0d91-4b0c-98ea-c4f6c0553832"),
		);
	});

	it("normalizes blank optional text to undefined", () => {
		const transaction = createTransaction({
			counterparty: "  ",
			description: "\t",
		});

		expect(transaction.counterparty).toBeUndefined();
		expect(transaction.description).toBeUndefined();
	});

	it.each([
		{ field: "counterparty", value: 123 },
		{ field: "description", value: false },
	] as const)(
		"reports the exact invalid-text contract for $field",
		({ field, value }) => {
			expectTransactionError(
				() =>
					createTransaction({ [field]: value } as unknown as Partial<
						ConstructorParameters<typeof Transaction>[0]
					>),
				"INVALID_TEXT",
				{ field, value },
			);
		},
	);

	it.each([
		{
			name: "an invalid type",
			overrides: { type: "TRANSFER" as TransactionType },
			expected: { code: "INVALID_TYPE", details: { value: "TRANSFER" } },
		},
		{
			name: "an invalid reference",
			overrides: { reference: " " },
			expected: { code: "INVALID_REFERENCE", details: { value: " " } },
		},
		{
			name: "a non-string reference",
			overrides: { reference: 123 } as unknown as Partial<
				ConstructorParameters<typeof Transaction>[0]
			>,
			expected: { code: "INVALID_REFERENCE", details: { value: 123 } },
		},
		{
			name: "an invalid date",
			overrides: { createdAt: new Date("invalid") },
			expected: {
				code: "INVALID_DATE",
				details: { value: new Date("invalid") },
			},
		},
	])(
		"reports a stable code and context for $name",
		({ overrides, expected }) => {
			let error: unknown;

			try {
				createTransaction(overrides);
			} catch (caughtError) {
				error = caughtError;
			}

			expect(error).toBeInstanceOf(TransactionError);
			expect(error).toHaveProperty("code", expected.code);
			expect(error).toHaveProperty("details", expected.details);
		},
	);

	it.each([
		{
			name: "non-string type",
			overrides: { type: 123 } as unknown as Partial<
				ConstructorParameters<typeof Transaction>[0]
			>,
			expected: { code: "INVALID_TYPE" as const, details: { value: 123 } },
		},
		{
			name: "non-Date createdAt",
			overrides: { createdAt: "2026-01-01" } as unknown as Partial<
				ConstructorParameters<typeof Transaction>[0]
			>,
			expected: {
				code: "INVALID_DATE" as const,
				details: { value: "2026-01-01" },
			},
		},
	])(
		"reports the exact error contract for $name",
		({ overrides, expected }) => {
			expectTransactionError(
				() => createTransaction(overrides),
				expected.code,
				expected.details,
			);
		},
	);

	it("defensively copies createdAt on input and output", () => {
		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const transaction = createTransaction({ createdAt });
		createdAt.setFullYear(2030);

		const exposedCreatedAt = transaction.createdAt;
		exposedCreatedAt.setFullYear(2030);

		expect(transaction.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
	});

	it("prevents observable changes to its state", () => {
		const transaction = createTransaction();

		expect(() => {
			(transaction as { reference: string }).reference = "changed";
		}).toThrow(TypeError);
		expect(() => {
			(transaction as { type: TransactionType }).type = TransactionType.DEBIT;
		}).toThrow(TypeError);
		expect(transaction.reference).toBe("deposit-001");
		expect(transaction.type).toBe(TransactionType.CREDIT);
	});
});

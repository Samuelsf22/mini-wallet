import { describe, expect, it } from "vitest";

import { Money } from "../../../../../shared/domain/value-objects/money.js";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.js";
import {
	Transaction,
	TransactionType,
} from "../../../domain/entities/transaction.js";
import {
	InvalidTransactionDateError,
	InvalidTransactionReferenceError,
	InvalidTransactionTextError,
	InvalidTransactionTypeError,
} from "../../../domain/errors/transaction.errors.js";

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

	it("rejects non-string optional text at the runtime boundary", () => {
		expect(() =>
			createTransaction({ counterparty: 123 as unknown as string }),
		).toThrow(InvalidTransactionTextError);
		expect(() =>
			createTransaction({ description: false as unknown as string }),
		).toThrow(InvalidTransactionTextError);
	});

	it("rejects an empty or non-string reference, invalid type, and invalid date", () => {
		expect(() => createTransaction({ reference: " " })).toThrow(
			InvalidTransactionReferenceError,
		);
		expect(() =>
			createTransaction({ reference: 123 as unknown as string }),
		).toThrow(InvalidTransactionReferenceError);
		expect(() =>
			createTransaction({ type: "TRANSFER" as TransactionType }),
		).toThrow(InvalidTransactionTypeError);
		expect(() => createTransaction({ createdAt: new Date("invalid") })).toThrow(
			InvalidTransactionDateError,
		);
	});

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

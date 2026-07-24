import type { Money } from "../../../../shared/domain/value-objects/money.js";
import type { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import { TransactionError } from "../errors/transaction.errors.js";

export const TransactionType = {
	CREDIT: "CREDIT",
	DEBIT: "DEBIT",
} as const;

export type TransactionType =
	(typeof TransactionType)[keyof typeof TransactionType];

export interface TransactionProps {
	id: Uuid;
	walletId: Uuid;
	type: TransactionType;
	amount: Money;
	counterparty?: string;
	description?: string;
	reference: string;
	createdAt: Date;
}

export class Transaction {
	private readonly _createdAt: Date;

	public constructor({
		id,
		walletId,
		type,
		amount,
		counterparty,
		description,
		reference,
		createdAt,
	}: TransactionProps) {
		if (type !== TransactionType.CREDIT && type !== TransactionType.DEBIT) {
			throw TransactionError.invalidType(type);
		}

		this.id = id;
		this.walletId = walletId;
		this.type = type;
		this.amount = amount;
		this.counterparty = normalizeOptionalText("counterparty", counterparty);
		this.description = normalizeOptionalText("description", description);
		this.reference = normalizeRequiredText(reference);
		this._createdAt = cloneValidDate(createdAt);

		Object.freeze(this);
	}

	public readonly id: Uuid;
	public readonly walletId: Uuid;
	public readonly type: TransactionType;
	public readonly amount: Money;
	public readonly counterparty: string | undefined;
	public readonly description: string | undefined;
	public readonly reference: string;

	public get createdAt(): Date {
		return new Date(this._createdAt);
	}
}

function normalizeRequiredText(value: unknown): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw TransactionError.invalidReference(value);
	}

	return value.trim();
}

function normalizeOptionalText(
	field: "counterparty" | "description",
	value: unknown,
): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== "string") {
		throw TransactionError.invalidText(field, value);
	}

	return value.trim() || undefined;
}

function cloneValidDate(value: unknown): Date {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw TransactionError.invalidDate(value);
	}

	return new Date(value);
}

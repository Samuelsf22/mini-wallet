import {
	Transaction,
	TransactionType,
} from "../../../../modules/transactions/domain/entities/transaction.js";
import { Money } from "../../../../shared/domain/value-objects/money.js";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import { TransactionEntity } from "./transaction.entity.js";

export function toDomainTransaction(entity: TransactionEntity): Transaction {
	return new Transaction({
		id: Uuid.of(entity.id),
		walletId: Uuid.of(entity.walletId),
		type: transactionType(entity.type),
		amount: Money.of(minorUnits(entity.amountMinorUnits), entity.currency),
		...(entity.counterparty === null
			? {}
			: { counterparty: entity.counterparty }),
		...(entity.description === null ? {} : { description: entity.description }),
		reference: entity.reference,
		createdAt: entity.createdAt,
	});
}

export function toTransactionEntity(
	transaction: Transaction,
): TransactionEntity {
	return Object.assign(new TransactionEntity(), {
		id: transaction.id.value,
		walletId: transaction.walletId.value,
		type: transaction.type,
		amountMinorUnits: String(transaction.amount.minorUnits),
		currency: transaction.amount.currency,
		counterparty: transaction.counterparty ?? null,
		description: transaction.description ?? null,
		reference: transaction.reference,
		createdAt: transaction.createdAt,
	});
}

function minorUnits(value: string): number {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) {
		throw new Error(`Persisted money amount is not a safe integer: ${value}.`);
	}

	return parsed;
}

function transactionType(value: string): TransactionType {
	if (value !== TransactionType.CREDIT && value !== TransactionType.DEBIT) {
		throw new Error(`Persisted transaction type is invalid: ${value}.`);
	}

	return value;
}

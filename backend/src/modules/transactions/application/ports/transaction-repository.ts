import type { Transaction } from "../../domain/entities/transaction.js";

export interface TransactionRepository {
	save(transaction: Transaction): Promise<void>;
}

import type { TransactionRepository } from "../../modules/transactions/application/ports/transaction-repository.js";
import type { Transaction } from "../../modules/transactions/domain/entities/transaction.js";
import type { WalletRepository } from "../../modules/wallets/application/ports/wallet-repository.js";
import type { Money } from "../domain/value-objects/money.js";

export interface TransferIntent {
	sourceWalletId: string;
	targetWalletId: string;
	amountMinorUnits: number;
	currency: string;
	description?: string;
}

export interface TransferRequestIntent {
	sourceUserId: string;
	recipientEmail: string;
	amountMinorUnits: number;
	description?: string;
}

export type TransferClaim =
	| { status: "claimed" }
	| {
			status: "replay";
			debitTransaction: Transaction;
			creditTransaction: Transaction;
			newBalance: Money;
	  }
	| { status: "in_progress" }
	| { status: "conflict" };

export interface AtomicWriteContext {
	wallets: WalletRepository;
	transactions: TransactionRepository;
	claimTransfer(
		key: string,
		intent: TransferRequestIntent,
	): Promise<TransferClaim>;
	completeTransferClaim(
		key: string,
		intent: TransferIntent,
		debitTransaction: Transaction,
		creditTransaction: Transaction,
		newBalance: Money,
	): Promise<void>;
}

export interface AtomicWriteBoundary {
	execute<T>(
		operation: (context: AtomicWriteContext) => Promise<T>,
	): Promise<T>;
}

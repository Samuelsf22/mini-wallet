import type { TransactionRepository } from "../../modules/transactions/application/ports/transaction-repository.js";
import type { Transaction } from "../../modules/transactions/domain/entities/transaction.js";
import type { UserRepository } from "../../modules/users/application/ports/user-repository.js";
import type { WalletRepository } from "../../modules/wallets/application/ports/wallet-repository.js";
import type { Wallet } from "../../modules/wallets/domain/entities/wallet.js";
import type { Money } from "../domain/value-objects/money.js";
import type { Uuid } from "../domain/value-objects/uuid.js";

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

/**
 * A matching duplicate waits for the prior atomic attempt: it replays a completed
 * transfer, or can be claimed when that attempt rolls back.
 */
export type TransferClaim =
	| { status: "claimed" }
	| {
			status: "replay";
			debitTransaction: Transaction;
			creditTransaction: Transaction;
			newBalance: Money;
	  }
	| { status: "conflict" };

export interface AtomicWriteContext {
	users: UserRepository;
	wallets: WalletRepository;
	transactions: TransactionRepository;
	loadTransferWallets(
		sourceUserId: Uuid,
		targetUserId: Uuid,
	): Promise<{ source: Wallet | undefined; target: Wallet | undefined }>;
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

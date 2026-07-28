import type { AtomicWriteBoundary } from "../../../../shared/application/atomic-write-boundary.js";
import type { AuthenticatedUser } from "../../../../shared/application/authenticated-user.js";
import { ApplicationError } from "../../../../shared/application/errors/application.errors.js";
import { Money } from "../../../../shared/domain/value-objects/money.js";
import type { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import {
	Transaction,
	TransactionType,
} from "../../../transactions/domain/entities/transaction.js";
import { Timestamp } from "../../domain/value-objects/timestamp.js";

export interface RechargeWalletInput {
	amount: number;
}

export interface RechargeWalletResult {
	transaction: Transaction;
}

export interface RechargeWalletDependencies {
	atomicWriteBoundary: AtomicWriteBoundary;
	createId: () => Uuid;
	clock?: () => Date;
}

export class RechargeWalletUseCase {
	public constructor(
		private readonly dependencies: RechargeWalletDependencies,
	) {}

	public async execute(
		currentUser: AuthenticatedUser,
		input: RechargeWalletInput,
	): Promise<RechargeWalletResult> {
		const occurredAt = Timestamp.now(this.dependencies.clock);

		return this.dependencies.atomicWriteBoundary.execute(async (context) => {
			const wallet = await context.wallets.findByUserId(currentUser.userId);
			if (wallet === undefined) {
				throw ApplicationError.walletNotFound(currentUser.userId.value);
			}

			const amount = Money.of(input.amount, wallet.currency);
			if (amount.minorUnits === 0) {
				throw ApplicationError.invalidInput("amount", input.amount);
			}
			wallet.credit(amount, occurredAt);
			const transactionId = this.dependencies.createId();
			const transaction = new Transaction({
				id: transactionId,
				walletId: wallet.id,
				type: TransactionType.CREDIT,
				amount,
				reference: transactionId.value,
				createdAt: occurredAt.toDate(),
			});

			await context.wallets.save(wallet);
			await context.transactions.save(transaction);

			return { transaction };
		});
	}
}

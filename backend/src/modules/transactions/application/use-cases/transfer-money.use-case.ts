import type { AtomicWriteBoundary } from "../../../../shared/application/atomic-write-boundary.js";
import type { AuthenticatedUser } from "../../../../shared/application/authenticated-user.js";
import { ApplicationError } from "../../../../shared/application/errors/application.errors.js";
import { optionalText } from "../../../../shared/application/optional-text.js";
import { requiredText } from "../../../../shared/application/required-text.js";
import { Money } from "../../../../shared/domain/value-objects/money.js";
import type { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import type { UserRepository } from "../../../users/application/ports/user-repository.js";
import { Email } from "../../../users/domain/value-objects/email.js";
import { Timestamp } from "../../../wallets/domain/value-objects/timestamp.js";
import {
	Transaction,
	TransactionType,
} from "../../domain/entities/transaction.js";

export const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

export interface TransferMoneyInput {
	recipientEmail: string;
	amount: number;
	description?: string;
	idempotencyKey: string;
}

export interface TransferMoneyResult {
	transaction: Transaction;
	newBalance: Money;
	replayed: boolean;
}

export interface TransferMoneyDependencies {
	atomicWriteBoundary: AtomicWriteBoundary;
	users: UserRepository;
	createId: () => Uuid;
	clock?: () => Date;
}

export class TransferMoneyUseCase {
	public constructor(
		private readonly dependencies: TransferMoneyDependencies,
	) {}

	public async execute(
		currentUser: AuthenticatedUser,
		input: TransferMoneyInput,
	): Promise<TransferMoneyResult> {
		const recipientEmail = Email.of(input.recipientEmail);
		const amountMinorUnits = Money.of(input.amount, "USD").minorUnits;
		const description = optionalText("description", input.description);
		const idempotencyKey = requiredText("idempotencyKey", input.idempotencyKey);
		const idempotencyKeyLength = Array.from(idempotencyKey).length;
		if (idempotencyKeyLength > MAX_IDEMPOTENCY_KEY_LENGTH) {
			throw ApplicationError.invalidIdempotencyKey(
				idempotencyKeyLength,
				MAX_IDEMPOTENCY_KEY_LENGTH,
			);
		}
		const occurredAt = Timestamp.now(this.dependencies.clock);

		return this.dependencies.atomicWriteBoundary.execute(async (context) => {
			const claim = await context.claimTransfer(idempotencyKey, {
				sourceUserId: currentUser.userId.value,
				recipientEmail: recipientEmail.value,
				amountMinorUnits,
				...(description === undefined ? {} : { description }),
			});
			if (claim.status === "replay") {
				return {
					transaction: claim.debitTransaction,
					newBalance: claim.newBalance,
					replayed: true,
				};
			}
			if (claim.status === "in_progress") {
				throw ApplicationError.transferInProgress(idempotencyKey);
			}
			if (claim.status === "conflict") {
				throw ApplicationError.idempotencyConflict(idempotencyKey);
			}
			const recipient =
				await this.dependencies.users.findByEmail(recipientEmail);
			if (recipient === undefined) {
				throw ApplicationError.userNotFound(recipientEmail.value);
			}
			const sourceWallet = await context.wallets.findByUserId(
				currentUser.userId,
			);
			if (sourceWallet === undefined) {
				throw ApplicationError.walletNotFound(currentUser.userId.value);
			}
			const targetWallet = await context.wallets.findByUserId(recipient.id);
			if (targetWallet === undefined) {
				throw ApplicationError.walletNotFound(recipient.id.value);
			}
			if (sourceWallet.id.equals(targetWallet.id)) {
				throw ApplicationError.sameWalletTransfer(sourceWallet.id.value);
			}

			const amount = Money.of(amountMinorUnits, sourceWallet.currency);

			sourceWallet.debit(amount, occurredAt);
			targetWallet.credit(amount, occurredAt);
			const debitTransaction = new Transaction({
				id: this.dependencies.createId(),
				walletId: sourceWallet.id,
				type: TransactionType.DEBIT,
				amount,
				counterparty: targetWallet.id.value,
				...(description === undefined ? {} : { description }),
				reference: idempotencyKey,
				createdAt: occurredAt.toDate(),
			});
			const creditTransaction = new Transaction({
				id: this.dependencies.createId(),
				walletId: targetWallet.id,
				type: TransactionType.CREDIT,
				amount,
				counterparty: sourceWallet.id.value,
				...(description === undefined ? {} : { description }),
				reference: idempotencyKey,
				createdAt: occurredAt.toDate(),
			});

			await context.wallets.save(sourceWallet);
			await context.wallets.save(targetWallet);
			await context.transactions.save(debitTransaction);
			await context.transactions.save(creditTransaction);
			await context.completeTransferClaim(
				idempotencyKey,
				{
					sourceWalletId: sourceWallet.id.value,
					targetWalletId: targetWallet.id.value,
					amountMinorUnits: amount.minorUnits,
					currency: amount.currency,
					...(description === undefined ? {} : { description }),
				},
				debitTransaction,
				creditTransaction,
				sourceWallet.balance,
			);

			return {
				transaction: debitTransaction,
				newBalance: sourceWallet.balance,
				replayed: false,
			};
		});
	}
}

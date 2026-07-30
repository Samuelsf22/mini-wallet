import type { DataSource, EntityManager } from "typeorm";
import type { Transaction } from "../../../../modules/transactions/domain/entities/transaction.js";
import type {
	AtomicWriteBoundary,
	AtomicWriteContext,
	TransferClaim,
	TransferIntent,
	TransferRequestIntent,
} from "../../../../shared/application/atomic-write-boundary.js";
import { Money } from "../../../../shared/domain/value-objects/money.js";
import type { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import { TransactionEntity } from "../transactions/transaction.entity.js";
import { toDomainTransaction } from "../transactions/transaction.mapper.js";
import {
	TransferClaimStatus,
	TransferIdempotencyClaimEntity,
} from "../transactions/transfer-idempotency-claim.entity.js";
import { TypeormTransactionRepository } from "../transactions/typeorm-transaction-repository.js";
import { TypeormUserRepository } from "../users/typeorm-user-repository.js";
import { TypeormWalletRepository } from "../wallets/typeorm-wallet-repository.js";
import { WalletEntity } from "../wallets/wallet.entity.js";
import { toDomainWallet } from "../wallets/wallet.mapper.js";

export class TypeormAtomicWriteBoundary implements AtomicWriteBoundary {
	public constructor(private readonly dataSource: DataSource) {}

	public async execute<T>(
		operation: (context: AtomicWriteContext) => Promise<T>,
	): Promise<T> {
		const queryRunner = this.dataSource.createQueryRunner();
		let transactionStarted = false;
		try {
			await queryRunner.connect();
			await queryRunner.startTransaction();
			transactionStarted = true;
			const context = createAtomicContext(queryRunner.manager);
			const result = await operation(context);
			await queryRunner.commitTransaction();
			return result;
		} catch (error) {
			if (transactionStarted) {
				await queryRunner.rollbackTransaction();
			}
			throw error;
		} finally {
			await queryRunner.release();
		}
	}
}

function createAtomicContext(manager: EntityManager): AtomicWriteContext {
	return {
		users: new TypeormUserRepository(manager),
		wallets: new TypeormWalletRepository(manager),
		transactions: new TypeormTransactionRepository(manager),
		loadTransferWallets: (sourceUserId, targetUserId) =>
			loadTransferWallets(manager, sourceUserId, targetUserId),
		claimTransfer: (key, intent) => claimTransfer(manager, key, intent),
		completeTransferClaim: (key, intent, debit, credit, balance) =>
			completeTransferClaim(manager, key, intent, debit, credit, balance),
	};
}

async function loadTransferWallets(
	manager: EntityManager,
	sourceUserId: Uuid,
	targetUserId: Uuid,
): Promise<{
	source: ReturnType<typeof toDomainWallet> | undefined;
	target: ReturnType<typeof toDomainWallet> | undefined;
}> {
	const userIds = [sourceUserId.value, targetUserId.value];
	const rows = await manager
		.getRepository(WalletEntity)
		.createQueryBuilder("wallet")
		.where("wallet.user_id IN (:...userIds)", { userIds })
		.orderBy("wallet.id", "ASC")
		.setLock("pessimistic_write")
		.getMany();
	const walletsByUserId = new Map(
		rows.map((wallet) => [wallet.userId, toDomainWallet(wallet)]),
	);
	return {
		source: walletsByUserId.get(sourceUserId.value),
		target: walletsByUserId.get(targetUserId.value),
	};
}

async function claimTransfer(
	manager: EntityManager,
	key: string,
	intent: TransferRequestIntent,
): Promise<TransferClaim> {
	const insertResult = await manager.query(
		`INSERT INTO transfer_idempotency_claims (
			idempotency_key, source_user_id, recipient_email, request_amount_minor_units,
			request_description, status, created_at, completed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
		ON CONFLICT (idempotency_key) DO NOTHING
		RETURNING idempotency_key`,
		[
			key,
			intent.sourceUserId,
			intent.recipientEmail,
			String(intent.amountMinorUnits),
			intent.description ?? null,
			TransferClaimStatus.IN_PROGRESS,
			new Date(),
		],
	);
	if (Array.isArray(insertResult) && insertResult.length > 0) {
		return { status: "claimed" };
	}

	const repository = manager.getRepository(TransferIdempotencyClaimEntity);
	const existing = await repository.findOne({
		where: { idempotencyKey: key },
		lock: { mode: "pessimistic_write" },
	});
	if (existing === null)
		throw new Error("Transfer idempotency claim disappeared.");
	if (!sameRequestIntent(existing, intent)) return { status: "conflict" };
	if (existing.status !== TransferClaimStatus.COMPLETED)
		throw new Error("Duplicate transfer claim did not complete.");
	return replayClaim(manager, existing);
}

async function completeTransferClaim(
	manager: EntityManager,
	key: string,
	intent: TransferIntent,
	debit: Transaction,
	credit: Transaction,
	newBalance: Money,
): Promise<void> {
	const repository = manager.getRepository(TransferIdempotencyClaimEntity);
	const claim = await repository.findOne({
		where: { idempotencyKey: key },
		lock: { mode: "pessimistic_write" },
	});
	if (claim === null || claim.status !== TransferClaimStatus.IN_PROGRESS) {
		throw new Error("Transfer idempotency claim is not in progress.");
	}

	claim.status = TransferClaimStatus.COMPLETED;
	claim.resolvedSourceWalletId = intent.sourceWalletId;
	claim.resolvedTargetWalletId = intent.targetWalletId;
	claim.resolvedAmountMinorUnits = String(intent.amountMinorUnits);
	claim.resolvedCurrency = intent.currency;
	claim.resolvedDescription = intent.description ?? null;
	claim.debitTransactionId = debit.id.value;
	claim.creditTransactionId = credit.id.value;
	claim.replayBalanceMinorUnits = String(newBalance.minorUnits);
	claim.completedAt = new Date();
	await repository.save(claim);
}

async function replayClaim(
	manager: EntityManager,
	claim: TransferIdempotencyClaimEntity,
): Promise<TransferClaim> {
	if (
		claim.debitTransactionId === null ||
		claim.creditTransactionId === null ||
		claim.replayBalanceMinorUnits === null ||
		claim.resolvedCurrency === null
	) {
		throw new Error("Completed transfer claim is corrupt.");
	}
	const transactions = manager.getRepository(TransactionEntity);
	const [debit, credit] = await Promise.all([
		transactions.findOneBy({ id: claim.debitTransactionId }),
		transactions.findOneBy({ id: claim.creditTransactionId }),
	]);
	if (debit === null || credit === null) {
		throw new Error(
			"Completed transfer claim references missing transactions.",
		);
	}

	return {
		status: "replay",
		debitTransaction: toDomainTransaction(debit),
		creditTransaction: toDomainTransaction(credit),
		newBalance: Money.of(
			minorUnits(claim.replayBalanceMinorUnits),
			claim.resolvedCurrency,
		),
	};
}

function sameRequestIntent(
	claim: TransferIdempotencyClaimEntity,
	intent: TransferRequestIntent,
): boolean {
	return (
		claim.sourceUserId === intent.sourceUserId &&
		claim.recipientEmail === intent.recipientEmail &&
		claim.requestAmountMinorUnits === String(intent.amountMinorUnits) &&
		claim.requestDescription === (intent.description ?? null)
	);
}

function minorUnits(value: string): number {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) {
		throw new Error(`Persisted money amount is not a safe integer: ${value}.`);
	}
	return parsed;
}

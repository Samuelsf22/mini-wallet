import { describe, expect, it } from "vitest";
import { Uuid } from "../../../shared/domain/value-objects/uuid.js";
import { TypeormAtomicWriteBoundary } from "../../persistence/typeorm/shared/typeorm-atomic-write-boundary.js";
import type { TransactionEntity } from "../../persistence/typeorm/transactions/transaction.entity.js";
import { toDomainTransaction } from "../../persistence/typeorm/transactions/transaction.mapper.js";
import {
	TransferClaimStatus,
	TransferIdempotencyClaimEntity,
} from "../../persistence/typeorm/transactions/transfer-idempotency-claim.entity.js";
import { TypeormWalletRepository } from "../../persistence/typeorm/wallets/typeorm-wallet-repository.js";

const transferIntent = {
	sourceUserId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
	recipientEmail: "recipient@example.com",
	amountMinorUnits: 10,
};

describe("TypeORM mappers", () => {
	it("reconstructs transaction Money from the persisted transaction currency", () => {
		const transaction = toDomainTransaction({
			id: "11111111-1111-1111-1111-111111111111",
			walletId: "22222222-2222-2222-2222-222222222222",
			type: "CREDIT",
			amountMinorUnits: "10",
			currency: "EUR",
			counterparty: null,
			description: null,
			reference: "reference",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		} as TransactionEntity);

		expect(transaction.amount.currency).toBe("EUR");
		expect(transaction.amount.minorUnits).toBe(10);
	});

	it("rejects a persisted transaction amount outside JavaScript safe integers", () => {
		expect(() =>
			toDomainTransaction({
				id: "11111111-1111-1111-1111-111111111111",
				walletId: "22222222-2222-2222-2222-222222222222",
				type: "CREDIT",
				amountMinorUnits: "9007199254740992",
				currency: "USD",
				counterparty: null,
				description: null,
				reference: "reference",
				createdAt: new Date(),
			} as TransactionEntity),
		).toThrow("safe integer");
	});
});

describe("TypeORM atomic write boundary", () => {
	it("commits and always releases a successful transaction", async () => {
		const lifecycle: string[] = [];
		const boundary = new TypeormAtomicWriteBoundary({
			createQueryRunner: () => ({
				connect: async () => lifecycle.push("connect"),
				startTransaction: async () => lifecycle.push("start"),
				commitTransaction: async () => lifecycle.push("commit"),
				rollbackTransaction: async () => lifecycle.push("rollback"),
				release: async () => lifecycle.push("release"),
				manager: {} as never,
			}),
		} as never);

		await expect(boundary.execute(async () => "done")).resolves.toBe("done");
		expect(lifecycle).toEqual(["connect", "start", "commit", "release"]);
	});

	it("rolls back and releases when the operation fails", async () => {
		const lifecycle: string[] = [];
		const boundary = new TypeormAtomicWriteBoundary({
			createQueryRunner: () => ({
				connect: async () => lifecycle.push("connect"),
				startTransaction: async () => lifecycle.push("start"),
				commitTransaction: async () => lifecycle.push("commit"),
				rollbackTransaction: async () => lifecycle.push("rollback"),
				release: async () => lifecycle.push("release"),
				manager: {} as never,
			}),
		} as never);

		await expect(
			boundary.execute(async () => Promise.reject(new Error("failure"))),
		).rejects.toThrow("failure");
		expect(lifecycle).toEqual(["connect", "start", "rollback", "release"]);
	});

	it("rolls back and releases when commit fails", async () => {
		const lifecycle: string[] = [];
		const boundary = new TypeormAtomicWriteBoundary({
			createQueryRunner: () => ({
				connect: async () => lifecycle.push("connect"),
				startTransaction: async () => lifecycle.push("start"),
				commitTransaction: async () => {
					lifecycle.push("commit");
					throw new Error("commit failure");
				},
				rollbackTransaction: async () => lifecycle.push("rollback"),
				release: async () => lifecycle.push("release"),
				manager: {} as never,
			}),
		} as never);

		await expect(boundary.execute(async () => "done")).rejects.toThrow(
			"commit failure",
		);
		expect(lifecycle).toEqual([
			"connect",
			"start",
			"commit",
			"rollback",
			"release",
		]);
	});

	it("releases when transaction setup fails before it starts", async () => {
		const lifecycle: string[] = [];
		const boundary = new TypeormAtomicWriteBoundary({
			createQueryRunner: () => ({
				connect: async () => lifecycle.push("connect"),
				startTransaction: async () =>
					Promise.reject(new Error("start failure")),
				commitTransaction: async () => lifecycle.push("commit"),
				rollbackTransaction: async () => lifecycle.push("rollback"),
				release: async () => lifecycle.push("release"),
				manager: {} as never,
			}),
		} as never);

		await expect(boundary.execute(async () => "unused")).rejects.toThrow(
			"start failure",
		);
		expect(lifecycle).toEqual(["connect", "release"]);
	});

	it("returns conflict for a durable claim with a different request intent", async () => {
		const claim = Object.assign(new TransferIdempotencyClaimEntity(), {
			idempotencyKey: "key",
			sourceUserId: transferIntent.sourceUserId,
			recipientEmail: transferIntent.recipientEmail,
			requestAmountMinorUnits: "10",
			requestDescription: null,
			status: TransferClaimStatus.COMPLETED,
		});
		const repository = {
			findOne: async () => claim,
		};
		const manager = {
			query: async () => [],
			getRepository: () => repository,
		};
		const boundary = new TypeormAtomicWriteBoundary({
			createQueryRunner: () => ({
				connect: async () => undefined,
				startTransaction: async () => undefined,
				commitTransaction: async () => undefined,
				rollbackTransaction: async () => undefined,
				release: async () => undefined,
				manager,
			}),
		} as never);

		const claimResult = await boundary.execute((context) =>
			context.claimTransfer("key", {
				...transferIntent,
				amountMinorUnits: 11,
			}),
		);
		expect(claimResult).toEqual({ status: "conflict" });
	});

	it("returns claimed without unique-violation control flow", async () => {
		const insert = async () => {
			throw new Error(
				"Repository insert must not be used for transfer claims.",
			);
		};
		const claimedBoundary = boundaryWithManager({
			query: async () => [{ idempotency_key: "key" }],
			getRepository: () => ({ findOne: async () => null, insert }),
		});
		await expect(
			claimedBoundary.execute((context) =>
				context.claimTransfer("key", transferIntent),
			),
		).resolves.toEqual({ status: "claimed" });
	});

	it("replays a completed claim after a conflict-safe duplicate query", async () => {
		const claim = completedClaim();
		const queries: string[] = [];
		const transaction = {
			id: "33333333-3333-3333-3333-333333333333",
			walletId: "11111111-1111-1111-1111-111111111111",
			type: "DEBIT",
			amountMinorUnits: "10",
			currency: "USD",
			counterparty: "22222222-2222-2222-2222-222222222222",
			description: null,
			reference: "key",
			createdAt: new Date(),
		};
		const claimRepository = {
			findOne: async () => claim,
			insert: async () => {
				throw new Error(
					"Repository insert must not be used for transfer claims.",
				);
			},
		};
		const transactionRepository = { findOneBy: async () => transaction };
		const boundary = boundaryWithManager({
			query: async (query: string) => {
				queries.push(query);
				return [];
			},
			getRepository: (entity: unknown) =>
				entity === TransferIdempotencyClaimEntity
					? claimRepository
					: transactionRepository,
		});

		await expect(
			boundary.execute((context) =>
				context.claimTransfer("key", transferIntent),
			),
		).resolves.toMatchObject({ status: "replay" });
		expect(queries).toHaveLength(1);
		expect(queries[0]).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
	});
});

describe("TypeORM wallet repository", () => {
	it("loads both transfer wallets with one sorted pessimistic lock query", async () => {
		const calls: string[] = [];
		const rows = [
			{
				id: "22222222-2222-2222-2222-222222222222",
				userId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				balanceMinorUnits: "10",
				currency: "USD",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: "11111111-1111-1111-1111-111111111111",
				userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				balanceMinorUnits: "20",
				currency: "USD",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];
		const query = {
			where: (_sql: string, parameters: { userIds: string[] }) => {
				calls.push(`where:${parameters.userIds.join(",")}`);
				return query;
			},
			orderBy: (field: string, direction: string) => {
				calls.push(`orderBy:${field}:${direction}`);
				return query;
			},
			setLock: (mode: string) => {
				calls.push(`lock:${mode}`);
				return query;
			},
			getMany: async () => rows,
		};
		const boundary = boundaryWithManager({
			getRepository: () => ({ createQueryBuilder: () => query }),
		});

		const wallets = await boundary.execute((context) =>
			context.loadTransferWallets(
				Uuid.of("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
				Uuid.of("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
			),
		);

		expect(wallets.source?.id.value).toBe(
			"22222222-2222-2222-2222-222222222222",
		);
		expect(wallets.target?.id.value).toBe(
			"11111111-1111-1111-1111-111111111111",
		);
		expect(calls).toEqual([
			"where:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb,aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
			"orderBy:wallet.id:ASC",
			"lock:pessimistic_write",
		]);
	});

	it("uses a pessimistic write lock and stable UUID ordering inside a boundary", async () => {
		const calls: string[] = [];
		const query = {
			setLock: (mode: string) => {
				calls.push(`lock:${mode}`);
				return query;
			},
			getOne: async () => null,
		};
		const repository = new TypeormWalletRepository(
			{
				getRepository: () => ({
					createQueryBuilder: () => ({
						where: () => {
							calls.push("where");
							return {
								orderBy: (field: string, direction: string) => {
									calls.push(`orderBy:${field}:${direction}`);
									return query;
								},
							};
						},
					}),
				}),
			} as never,
			true,
		);

		await repository.findByUserId(
			Uuid.of("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
		);
		expect(calls).toEqual([
			"where",
			"orderBy:wallet.id:ASC",
			"lock:pessimistic_write",
		]);
	});
});

function boundaryWithManager(manager: object): TypeormAtomicWriteBoundary {
	return new TypeormAtomicWriteBoundary({
		createQueryRunner: () => ({
			connect: async () => undefined,
			startTransaction: async () => undefined,
			commitTransaction: async () => undefined,
			rollbackTransaction: async () => undefined,
			release: async () => undefined,
			manager,
		}),
	} as never);
}

function completedClaim(): TransferIdempotencyClaimEntity {
	return Object.assign(new TransferIdempotencyClaimEntity(), {
		idempotencyKey: "key",
		sourceUserId: transferIntent.sourceUserId,
		recipientEmail: transferIntent.recipientEmail,
		requestAmountMinorUnits: "10",
		requestDescription: null,
		status: TransferClaimStatus.COMPLETED,
		debitTransactionId: "33333333-3333-3333-3333-333333333333",
		creditTransactionId: "44444444-4444-4444-4444-444444444444",
		replayBalanceMinorUnits: "90",
		resolvedCurrency: "USD",
	});
}

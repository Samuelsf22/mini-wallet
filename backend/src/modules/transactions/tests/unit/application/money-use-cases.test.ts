import { describe, expect, it } from "vitest";
import type {
	AtomicWriteBoundary,
	AtomicWriteContext,
	TransferIntent,
	TransferRequestIntent,
} from "../../../../../shared/application/atomic-write-boundary.js";
import type { AuthenticatedUser } from "../../../../../shared/application/authenticated-user.js";
import { MoneyError } from "../../../../../shared/domain/errors/money.errors.js";
import { Money } from "../../../../../shared/domain/value-objects/money.js";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.js";
import type { UserRepository } from "../../../../users/application/ports/user-repository.js";
import { User } from "../../../../users/domain/entities/user.js";
import { Email } from "../../../../users/domain/value-objects/email.js";
import type { WalletRepository } from "../../../../wallets/application/ports/wallet-repository.js";
import { RechargeWalletUseCase } from "../../../../wallets/application/use-cases/recharge-wallet.use-case.js";
import { Wallet } from "../../../../wallets/domain/entities/wallet.js";
import { Timestamp } from "../../../../wallets/domain/value-objects/timestamp.js";
import type { TransactionRepository } from "../../../application/ports/transaction-repository.js";
import { TransferMoneyUseCase } from "../../../application/use-cases/transfer-money.use-case.js";
import type { Transaction } from "../../../domain/entities/transaction.js";

const IDs = {
	sourceUser: Uuid.of("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
	targetUser: Uuid.of("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
	thirdUser: Uuid.of("cccccccc-cccc-cccc-cccc-cccccccccccc"),
	sourceWallet: Uuid.of("11111111-1111-1111-1111-111111111111"),
	targetWallet: Uuid.of("22222222-2222-2222-2222-222222222222"),
	thirdWallet: Uuid.of("33333333-3333-3333-3333-333333333333"),
	transactionOne: Uuid.of("44444444-4444-4444-4444-444444444444"),
	transactionTwo: Uuid.of("55555555-5555-5555-5555-555555555555"),
	transactionThree: Uuid.of("66666666-6666-6666-6666-666666666666"),
	transactionFour: Uuid.of("77777777-7777-7777-7777-777777777777"),
};

const fixedClock = () => new Date("2026-07-27T12:00:00.000Z");
const currentUser: AuthenticatedUser = { userId: IDs.sourceUser };

describe("RechargeWalletUseCase", () => {
	it("credits only the authenticated user's wallet and records a transaction", async () => {
		const store = new InMemoryAtomicWriteBoundary([
			wallet(IDs.sourceWallet, IDs.sourceUser, 100),
			wallet(IDs.targetWallet, IDs.targetUser, 10),
		]);
		const useCase = rechargeUseCase(store);

		const result = await useCase.execute(currentUser, {
			amount: 25,
			walletId: IDs.targetWallet.value,
		} as unknown as { amount: number });

		expect(store.balanceOf(IDs.sourceWallet)).toBe(125);
		expect(store.balanceOf(IDs.targetWallet)).toBe(10);
		expect(result.transaction.amount.currency).toBe("USD");
		expect(result.transaction.reference).toBe(IDs.transactionOne.value);
	});

	it("does not accept a caller-selected wallet when the current user has none", async () => {
		const store = new InMemoryAtomicWriteBoundary([
			wallet(IDs.targetWallet, IDs.targetUser, 10),
		]);

		await expect(
			rechargeUseCase(store).execute(currentUser, {
				amount: 25,
				walletId: IDs.targetWallet.value,
			} as unknown as { amount: number }),
		).rejects.toMatchObject({ code: "WALLET_NOT_FOUND" });
		expect(store.balanceOf(IDs.targetWallet)).toBe(10);
	});

	it.each([
		{ amount: 0, code: "INVALID_INPUT" },
		{ amount: 1.5, code: "INVALID_MINOR_UNITS" },
	])(
		"rejects invalid recharge amount $amount without writes",
		async ({ amount, code }) => {
			const store = new InMemoryAtomicWriteBoundary([
				wallet(IDs.sourceWallet, IDs.sourceUser, 100),
			]);
			await expect(
				rechargeUseCase(store).execute(currentUser, { amount }),
			).rejects.toMatchObject({ code });
			expect(store.balanceOf(IDs.sourceWallet)).toBe(100);
			expect(store.transactions).toHaveLength(0);
		},
	);
});

describe("TransferMoneyUseCase", () => {
	it("resolves the recipient email, derives source currency, and records description", async () => {
		const store = standardStore();
		const result = await transferUseCase(store).execute(
			currentUser,
			transferInput(),
		);

		expect(result.replayed).toBe(false);
		expect(result.transaction.walletId).toEqual(IDs.sourceWallet);
		expect(result.transaction.amount).toEqual(Money.of(40, "USD"));
		expect(result.transaction.description).toBe("Dinner");
		expect(result.newBalance).toEqual(Money.of(60, "USD"));
		expect(store.transactions).toHaveLength(2);
		expect(store.transactions[1]?.description).toBe("Dinner");
	});

	it("ignores arbitrary source wallet fields outside the public transfer contract", async () => {
		const store = standardStore();
		await transferUseCase(store).execute(currentUser, {
			...transferInput(),
			sourceWalletId: IDs.thirdWallet.value,
		} as unknown as ReturnType<typeof transferInput>);

		expect(store.balanceOf(IDs.sourceWallet)).toBe(60);
		expect(store.balanceOf(IDs.thirdWallet)).toBe(5);
	});

	it("persists an omitted optional description consistently", async () => {
		const store = standardStore();
		await transferUseCase(store).execute(currentUser, {
			recipientEmail: "target@example.com",
			amount: 40,
			idempotencyKey: "transfer-without-description",
		});

		expect(store.transactions).toHaveLength(2);
		expect(
			store.transactions.every(
				(transaction) => transaction.description === undefined,
			),
		).toBe(true);
	});

	it("rejects an unknown recipient and rolls back its claimed transfer", async () => {
		const store = standardStore();
		await expect(
			transferUseCase(store).execute(currentUser, {
				...transferInput(),
				recipientEmail: "missing@example.com",
			}),
		).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
		expect(store.executeCalls).toBe(1);
		expect(store.transactions).toHaveLength(0);
	});

	it("rejects a transfer to the current user's own wallet", async () => {
		const store = standardStore();
		await expect(
			transferUseCase(store).execute(currentUser, {
				...transferInput(),
				recipientEmail: "source@example.com",
			}),
		).rejects.toMatchObject({ code: "SAME_WALLET_TRANSFER" });
	});

	it("replays completed matching intents and conflicts on changed descriptions", async () => {
		const store = standardStore();
		const useCase = transferUseCase(store);
		await useCase.execute(currentUser, transferInput());

		await expect(
			useCase.execute(currentUser, transferInput()),
		).resolves.toMatchObject({
			replayed: true,
			newBalance: Money.of(60, "USD"),
		});
		await expect(
			useCase.execute(currentUser, { ...transferInput(), description: "Taxi" }),
		).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
	});

	it.each([
		{
			name: "recipient email",
			input: { ...transferInput(), recipientEmail: "third@example.com" },
			user: currentUser,
		},
		{
			name: "amount",
			input: { ...transferInput(), amount: 41 },
			user: currentUser,
		},
		{
			name: "authenticated source user",
			input: transferInput(),
			user: { userId: IDs.thirdUser },
		},
	])(
		"conflicts when a completed key changes $name",
		async ({ input, user }) => {
			const store = standardStore();
			const useCase = transferUseCase(store);
			await useCase.execute(currentUser, transferInput());

			await expect(useCase.execute(user, input)).rejects.toMatchObject({
				code: "IDEMPOTENCY_CONFLICT",
			});
			expect(store.transactions).toHaveLength(2);
		},
	);

	it("replays without recipient lookup after the original transfer completes", async () => {
		const store = standardStore();
		const users = standardUsers();
		const useCase = transferUseCase(store, users);
		const original = await useCase.execute(currentUser, transferInput());

		users.failLookups = true;
		const replay = await useCase.execute(currentUser, transferInput());

		expect(replay).toMatchObject({
			transaction: original.transaction,
			newBalance: original.newBalance,
			replayed: true,
		});
		expect(users.lookupCount).toBe(1);
		expect(store.transactions).toHaveLength(2);
	});

	it("replays without source or target wallet lookups after completion", async () => {
		const store = standardStore();
		const useCase = transferUseCase(store);
		const original = await useCase.execute(currentUser, transferInput());

		store.failWalletLookups = true;
		const replay = await useCase.execute(currentUser, transferInput());

		expect(replay).toMatchObject({
			transaction: original.transaction,
			newBalance: original.newBalance,
			replayed: true,
		});
		expect(store.walletLookupCount).toBe(2);
		expect(store.transactions).toHaveLength(2);
	});

	it("returns a typed in-progress error for a matching active claim", async () => {
		let notifyClaim: (() => void) | undefined;
		const claimed = new Promise<void>((resolve) => {
			notifyClaim = resolve;
		});
		let releaseClaim: (() => void) | undefined;
		const release = new Promise<void>((resolve) => {
			releaseClaim = resolve;
		});
		const store = standardStore({
			afterFirstClaim: async () => {
				notifyClaim?.();
				await release;
			},
		});
		const useCase = transferUseCase(store);

		const first = useCase.execute(currentUser, transferInput());
		await claimed;
		await expect(
			useCase.execute(currentUser, transferInput()),
		).rejects.toMatchObject({
			code: "TRANSFER_IN_PROGRESS",
		});
		releaseClaim?.();
		await expect(first).resolves.toMatchObject({ replayed: false });
	});

	it("rolls back staged writes and its claim when a transaction write fails", async () => {
		const store = standardStore({ failOn: "transaction" });
		const useCase = transferUseCase(store);
		await expect(useCase.execute(currentUser, transferInput())).rejects.toThrow(
			"Injected transaction write failure.",
		);
		expect(store.balanceOf(IDs.sourceWallet)).toBe(100);
		expect(store.transactions).toHaveLength(0);

		store.failOn = undefined;
		await expect(
			useCase.execute(currentUser, transferInput()),
		).resolves.toMatchObject({
			replayed: false,
		});
	});

	it("keeps domain currency failures atomic", async () => {
		const store = standardStore({ targetCurrency: "EUR" });
		await expect(
			transferUseCase(store).execute(currentUser, transferInput()),
		).rejects.toBeInstanceOf(MoneyError);
		expect(store.balanceOf(IDs.sourceWallet)).toBe(100);
		expect(store.transactions).toHaveLength(0);
	});

	it.each([
		{
			name: "malformed recipient email",
			input: { ...transferInput(), recipientEmail: "invalid" },
			error: "INVALID_EMAIL",
		},
		{
			name: "blank idempotency key",
			input: { ...transferInput(), idempotencyKey: " " },
			error: "INVALID_INPUT",
		},
		{
			name: "invalid amount",
			input: { ...transferInput(), amount: -1 },
			error: "INVALID_MINOR_UNITS",
		},
	])("rejects $name before claiming a transfer", async ({ input, error }) => {
		const store = standardStore();
		await expect(
			transferUseCase(store).execute(currentUser, input),
		).rejects.toMatchObject({ code: error });
		expect(store.executeCalls).toBe(0);
	});
});

function rechargeUseCase(boundary: AtomicWriteBoundary): RechargeWalletUseCase {
	return new RechargeWalletUseCase({
		atomicWriteBoundary: boundary,
		createId: createIdGenerator(IDs.transactionOne),
		clock: fixedClock,
	});
}

function transferUseCase(
	boundary: AtomicWriteBoundary,
	users: UserRepository = standardUsers(),
): TransferMoneyUseCase {
	return new TransferMoneyUseCase({
		atomicWriteBoundary: boundary,
		users,
		createId: createIdGenerator(
			IDs.transactionOne,
			IDs.transactionTwo,
			IDs.transactionThree,
			IDs.transactionFour,
		),
		clock: fixedClock,
	});
}

function standardUsers(): InMemoryUserRepository {
	return new InMemoryUserRepository([
		user(IDs.sourceUser, "source@example.com"),
		user(IDs.targetUser, "target@example.com"),
		user(IDs.thirdUser, "third@example.com"),
	]);
}

function transferInput() {
	return {
		recipientEmail: " target@example.com ",
		amount: 40,
		description: " Dinner ",
		idempotencyKey: "transfer-1",
	};
}

function standardStore(
	options: InMemoryBoundaryOptions = {},
): InMemoryAtomicWriteBoundary {
	return new InMemoryAtomicWriteBoundary(
		[
			wallet(IDs.sourceWallet, IDs.sourceUser, 100),
			wallet(IDs.targetWallet, IDs.targetUser, 10, options.targetCurrency),
			wallet(IDs.thirdWallet, IDs.thirdUser, 5),
		],
		options,
	);
}

function user(id: Uuid, email: string): User {
	return new User({
		id,
		email: Email.of(email),
		passwordHash: "hash",
		firstName: "Test",
		lastName: "User",
		createdAt: fixedClock(),
		updatedAt: fixedClock(),
	});
}

function wallet(
	id: Uuid,
	userId: Uuid,
	minorUnits: number,
	currency = "USD",
): Wallet {
	const timestamp = Timestamp.from(fixedClock());
	return new Wallet({
		id,
		userId,
		balance: Money.of(minorUnits, currency),
		createdAt: timestamp,
		updatedAt: timestamp,
	});
}

function createIdGenerator(...ids: Uuid[]): () => Uuid {
	let index = 0;
	return () => {
		const id = ids[index];
		if (id === undefined) {
			throw new Error("Test ID generator exhausted.");
		}
		index += 1;
		return id;
	};
}

type WriteTarget = "wallet" | "transaction";

interface InMemoryBoundaryOptions {
	failOn?: WriteTarget;
	afterFirstClaim?: () => Promise<void>;
	targetCurrency?: string;
}

interface TransferClaimRecord {
	requestIntent: TransferRequestIntent;
	resolvedIntent?: TransferIntent;
	debitTransaction?: Transaction;
	creditTransaction?: Transaction;
	newBalance?: Money;
}

class InMemoryAtomicWriteBoundary implements AtomicWriteBoundary {
	private readonly walletsByUserId = new Map<string, Wallet>();
	private transferClaims = new Map<string, TransferClaimRecord>();
	private readonly inProgressClaims = new Map<string, TransferRequestIntent>();
	private hasPausedFirstClaim = false;
	public transactions: Transaction[] = [];
	public executeCalls = 0;
	public failOn: WriteTarget | undefined;
	public failWalletLookups = false;
	public walletLookupCount = 0;

	public constructor(
		wallets: Wallet[] = [],
		private readonly options: InMemoryBoundaryOptions = {},
	) {
		this.failOn = options.failOn;
		for (const wallet of wallets) {
			this.walletsByUserId.set(wallet.userId.value, wallet);
		}
	}

	public async execute<T>(
		operation: (context: AtomicWriteContext) => Promise<T>,
	): Promise<T> {
		this.executeCalls += 1;
		const stagedWallets = new Map(
			[...this.walletsByUserId].map(([id, value]) => [id, cloneWallet(value)]),
		);
		const stagedTransactions = [...this.transactions];
		const stagedClaims = new Map(this.transferClaims);
		const claimedKeys = new Set<string>();
		const context: AtomicWriteContext = {
			wallets: new InMemoryWalletRepository(
				stagedWallets,
				() => this.failOn,
				() => {
					this.walletLookupCount += 1;
					return this.failWalletLookups;
				},
			),
			transactions: new InMemoryTransactionRepository(
				stagedTransactions,
				() => this.failOn,
			),
			claimTransfer: async (key, intent) => {
				const completed = stagedClaims.get(key);
				if (completed !== undefined) {
					if (!sameRequestIntent(completed.requestIntent, intent))
						return { status: "conflict" };
					if (
						completed.debitTransaction !== undefined &&
						completed.creditTransaction !== undefined &&
						completed.newBalance !== undefined
					) {
						return {
							status: "replay",
							debitTransaction: completed.debitTransaction,
							creditTransaction: completed.creditTransaction,
							newBalance: completed.newBalance,
						};
					}
				}
				const active = this.inProgressClaims.get(key);
				if (active !== undefined) {
					return sameRequestIntent(active, intent)
						? { status: "in_progress" }
						: { status: "conflict" };
				}

				this.inProgressClaims.set(key, intent);
				claimedKeys.add(key);
				stagedClaims.set(key, { requestIntent: intent });
				if (
					!this.hasPausedFirstClaim &&
					this.options.afterFirstClaim !== undefined
				) {
					this.hasPausedFirstClaim = true;
					await this.options.afterFirstClaim();
				}
				return { status: "claimed" };
			},
			completeTransferClaim: async (
				key,
				intent,
				debitTransaction,
				creditTransaction,
				newBalance,
			) => {
				const claim = stagedClaims.get(key);
				if (claim === undefined)
					throw new Error("Transfer claim was not found.");
				claim.resolvedIntent = intent;
				claim.debitTransaction = debitTransaction;
				claim.creditTransaction = creditTransaction;
				claim.newBalance = newBalance;
			},
		};

		try {
			const result = await operation(context);
			this.walletsByUserId.clear();
			for (const [id, wallet] of stagedWallets)
				this.walletsByUserId.set(id, wallet);
			this.transactions = stagedTransactions;
			this.transferClaims = stagedClaims;
			return result;
		} finally {
			for (const key of claimedKeys) this.inProgressClaims.delete(key);
		}
	}

	public balanceOf(walletId: Uuid): number {
		const wallet = [...this.walletsByUserId.values()].find((value) =>
			value.id.equals(walletId),
		);
		if (wallet === undefined)
			throw new Error("Wallet not found in test store.");
		return wallet.balance.minorUnits;
	}
}

class InMemoryWalletRepository implements WalletRepository {
	public constructor(
		private readonly walletsByUserId: Map<string, Wallet>,
		private readonly failureTarget: () => WriteTarget | undefined,
		private readonly lookupFailure: () => boolean,
	) {}

	public async findByUserId(userId: Uuid): Promise<Wallet | undefined> {
		if (this.lookupFailure())
			throw new Error("Injected wallet lookup failure.");
		return this.walletsByUserId.get(userId.value);
	}

	public async save(wallet: Wallet): Promise<void> {
		if (this.failureTarget() === "wallet")
			throw new Error("Injected wallet write failure.");
		this.walletsByUserId.set(wallet.userId.value, wallet);
	}
}

class InMemoryTransactionRepository implements TransactionRepository {
	public constructor(
		private readonly transactions: Transaction[],
		private readonly failureTarget: () => WriteTarget | undefined,
	) {}

	public async save(transaction: Transaction): Promise<void> {
		if (this.failureTarget() === "transaction") {
			throw new Error("Injected transaction write failure.");
		}
		this.transactions.push(transaction);
	}
}

class InMemoryUserRepository implements UserRepository {
	private readonly usersByEmail = new Map<string, User>();
	public failLookups = false;
	public lookupCount = 0;

	public constructor(users: User[]) {
		for (const user of users) this.usersByEmail.set(user.email.value, user);
	}

	public async findByEmail(email: Email): Promise<User | undefined> {
		this.lookupCount += 1;
		if (this.failLookups) throw new Error("Injected user lookup failure.");
		return this.usersByEmail.get(email.value);
	}
}

function sameRequestIntent(
	left: TransferRequestIntent,
	right: TransferRequestIntent,
): boolean {
	return (
		left.sourceUserId === right.sourceUserId &&
		left.recipientEmail === right.recipientEmail &&
		left.amountMinorUnits === right.amountMinorUnits &&
		left.description === right.description
	);
}

function cloneWallet(walletToClone: Wallet): Wallet {
	return new Wallet({
		id: walletToClone.id,
		userId: walletToClone.userId,
		balance: walletToClone.balance,
		createdAt: walletToClone.createdAt,
		updatedAt: walletToClone.updatedAt,
	});
}

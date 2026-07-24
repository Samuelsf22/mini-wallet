import { describe, expect, it } from "vitest";

import {
	CurrencyMismatchError,
	InsufficientFundsError,
} from "../../../../../shared/domain/errors/money.errors.js";
import { Money } from "../../../../../shared/domain/value-objects/money.js";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.js";
import { Wallet } from "../../../domain/entities/wallet.js";
import { Timestamp } from "../../../domain/value-objects/timestamp.js";

const initialCreatedAt = Timestamp.from(new Date("2026-07-24T08:00:00.000Z"));
const initialUpdatedAt = Timestamp.from(new Date("2026-07-24T09:00:00.000Z"));
const walletUuid = "6afc9fb6-8720-4e92-91d1-bc05ab978c78";
const userUuid = "0e4a98b5-b77f-4cf6-bf76-258de3ac5124";

const createWallet = (): Wallet =>
	new Wallet({
		id: Uuid.of(walletUuid),
		userId: Uuid.of(userUuid),
		balance: Money.of(500, "USD"),
		createdAt: initialCreatedAt,
		updatedAt: initialUpdatedAt,
	});

const walletState = (wallet: Wallet) => ({
	id: wallet.id,
	userId: wallet.userId,
	currency: wallet.currency,
	balance: wallet.balance,
	createdAt: wallet.createdAt.toDate(),
	updatedAt: wallet.updatedAt.toDate(),
});

describe("Wallet", () => {
	it("owns a Money balance and derives its currency from that balance", () => {
		const wallet = createWallet();

		expect(wallet).toMatchObject({
			id: Uuid.of(walletUuid),
			userId: Uuid.of(userUuid),
			balance: Money.of(500, "USD"),
		});
		expect(wallet.currency).toBe(wallet.balance.currency);
		expect(
			Object.getOwnPropertyDescriptor(Wallet.prototype, "balance")?.set,
		).toBeUndefined();
	});

	it("preserves the wallet and user identity fields", () => {
		const wallet = createWallet();

		expect(wallet.id).toEqual(Uuid.of(walletUuid));
		expect(wallet.userId).toEqual(Uuid.of(userUuid));
	});

	it("credits the balance and updates the lifecycle timestamp", () => {
		const wallet = createWallet();
		const creditAt = Timestamp.from(new Date("2026-07-24T10:00:00.000Z"));

		wallet.credit(Money.of(250, "USD"), creditAt);

		expect(wallet.balance).toEqual(Money.of(750, "USD"));
		expect(wallet.updatedAt.toDate()).toEqual(creditAt.toDate());
		expect(wallet.createdAt.toDate()).toEqual(initialCreatedAt.toDate());
	});

	it("debits the balance and deterministically updates updatedAt", () => {
		const wallet = createWallet();
		const debitAt = Timestamp.from(new Date("2026-07-24T10:00:00.000Z"));

		wallet.debit(Money.of(200, "USD"), debitAt);

		expect(wallet.balance).toEqual(Money.of(300, "USD"));
		expect(wallet.updatedAt.toDate()).toEqual(debitAt.toDate());
		expect(wallet.createdAt.toDate()).toEqual(initialCreatedAt.toDate());
	});

	it("preserves complete state when balance arithmetic rejects an operation", () => {
		const wallet = createWallet();
		const stateBeforeRejection = walletState(wallet);

		expect(() => wallet.debit(Money.of(501, "USD"))).toThrow(
			InsufficientFundsError,
		);
		expect(walletState(wallet)).toEqual(stateBeforeRejection);

		expect(() => wallet.credit(Money.of(100, "EUR"))).toThrow(
			CurrencyMismatchError,
		);
		expect(walletState(wallet)).toEqual(stateBeforeRejection);
	});
});

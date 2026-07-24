import type { Money } from "../value-objects/money.js";
import { Timestamp } from "../value-objects/timestamp.js";
import type { UserId } from "../value-objects/user-id.js";
import type { WalletId } from "../value-objects/wallet-id.js";

export interface WalletProps {
	id: WalletId;
	userId: UserId;
	balance: Money;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export class Wallet {
	private _balance: Money;
	private _updatedAt: Timestamp;

	public constructor({
		id,
		userId,
		balance,
		createdAt,
		updatedAt,
	}: WalletProps) {
		this.id = id;
		this.userId = userId;
		this._balance = balance;
		this.createdAt = createdAt;
		this._updatedAt = updatedAt;
	}

	public readonly id: WalletId;
	public readonly userId: UserId;
	public readonly createdAt: Timestamp;

	public get currency(): string {
		return this._balance.currency;
	}

	public get balance(): Money {
		return this._balance;
	}

	public get updatedAt(): Timestamp {
		return this._updatedAt;
	}

	public credit(amount: Money, occurredAt: Timestamp = Timestamp.now()): void {
		this._balance = this._balance.add(amount);
		this._updatedAt = occurredAt;
	}

	public debit(amount: Money, occurredAt: Timestamp = Timestamp.now()): void {
		this._balance = this._balance.subtract(amount);
		this._updatedAt = occurredAt;
	}
}

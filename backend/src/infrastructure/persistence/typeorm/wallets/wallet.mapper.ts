import { Wallet } from "../../../../modules/wallets/domain/entities/wallet.js";
import { Timestamp } from "../../../../modules/wallets/domain/value-objects/timestamp.js";
import { Money } from "../../../../shared/domain/value-objects/money.js";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import { WalletEntity } from "./wallet.entity.js";

export function toDomainWallet(entity: WalletEntity): Wallet {
	return new Wallet({
		id: Uuid.of(entity.id),
		userId: Uuid.of(entity.userId),
		balance: Money.of(minorUnits(entity.balanceMinorUnits), entity.currency),
		createdAt: Timestamp.from(entity.createdAt),
		updatedAt: Timestamp.from(entity.updatedAt),
	});
}

export function toWalletEntity(wallet: Wallet): WalletEntity {
	return Object.assign(new WalletEntity(), {
		id: wallet.id.value,
		userId: wallet.userId.value,
		balanceMinorUnits: String(wallet.balance.minorUnits),
		currency: wallet.currency,
		createdAt: wallet.createdAt.toDate(),
		updatedAt: wallet.updatedAt.toDate(),
	});
}

function minorUnits(value: string): number {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) {
		throw new Error(`Persisted money amount is not a safe integer: ${value}.`);
	}

	return parsed;
}

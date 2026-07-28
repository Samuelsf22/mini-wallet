import type { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import type { Wallet } from "../../domain/entities/wallet.js";

export interface WalletRepository {
	findByUserId(userId: Uuid): Promise<Wallet | undefined>;
	save(wallet: Wallet): Promise<void>;
}

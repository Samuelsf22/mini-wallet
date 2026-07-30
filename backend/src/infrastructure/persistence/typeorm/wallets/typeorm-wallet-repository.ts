import type { EntityManager } from "typeorm";
import type { WalletRepository } from "../../../../modules/wallets/application/ports/wallet-repository.js";
import type { Wallet } from "../../../../modules/wallets/domain/entities/wallet.js";
import type { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import { WalletEntity } from "./wallet.entity.js";
import { toDomainWallet, toWalletEntity } from "./wallet.mapper.js";

export class TypeormWalletRepository implements WalletRepository {
	public constructor(
		private readonly manager: EntityManager,
		private readonly lockForUpdate = false,
	) {}

	public async findByUserId(userId: Uuid): Promise<Wallet | undefined> {
		const query = this.manager
			.getRepository(WalletEntity)
			.createQueryBuilder("wallet")
			.where("wallet.user_id = :userId", { userId: userId.value })
			.orderBy("wallet.id", "ASC");
		if (this.lockForUpdate) {
			query.setLock("pessimistic_write");
		}

		const entity = await query.getOne();
		return entity === null ? undefined : toDomainWallet(entity);
	}

	public async save(wallet: Wallet): Promise<void> {
		await this.manager.getRepository(WalletEntity).save(toWalletEntity(wallet));
	}
}

import type { EntityManager } from "typeorm";
import type { TransactionRepository } from "../../../../modules/transactions/application/ports/transaction-repository.js";
import type { Transaction } from "../../../../modules/transactions/domain/entities/transaction.js";
import { TransactionEntity } from "./transaction.entity.js";
import { toTransactionEntity } from "./transaction.mapper.js";

export class TypeormTransactionRepository implements TransactionRepository {
	public constructor(private readonly manager: EntityManager) {}

	public async save(transaction: Transaction): Promise<void> {
		await this.manager
			.getRepository(TransactionEntity)
			.save(toTransactionEntity(transaction));
	}
}

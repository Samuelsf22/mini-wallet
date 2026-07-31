import type { AtomicWriteBoundary } from "../../../../shared/application/atomic-write-boundary.js";
import { ApplicationError } from "../../../../shared/application/errors/application.errors.js";
import { requiredSecret } from "../../../../shared/application/required-secret.js";
import { Money } from "../../../../shared/domain/value-objects/money.js";
import type { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import { Wallet } from "../../../wallets/domain/entities/wallet.js";
import { Timestamp } from "../../../wallets/domain/value-objects/timestamp.js";
import { User } from "../../domain/entities/user.js";
import { Email } from "../../domain/value-objects/email.js";
import {
	type AuthenticationUser,
	toAuthenticationUser,
} from "../authentication-user.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { TokenIssuer } from "../ports/token-issuer.js";

export interface RegisterUserInput {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
}

export interface RegisterUserResult {
	token: string;
	user: AuthenticationUser;
}

export interface RegisterUserDependencies {
	atomicWriteBoundary: AtomicWriteBoundary;
	passwordHasher: PasswordHasher;
	tokenIssuer: TokenIssuer;
	createId: () => Uuid;
	clock?: () => Date;
}

export class RegisterUserUseCase {
	public constructor(private readonly dependencies: RegisterUserDependencies) {}

	public async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
		const email = Email.of(input.email);
		const password = requiredSecret("password", input.password);
		const passwordHash = await this.dependencies.passwordHasher.hash(password);
		const occurredAt = this.dependencies.clock?.() ?? new Date();
		const user = await this.dependencies.atomicWriteBoundary.execute(
			async (context) => {
				if ((await context.users.findByEmail(email)) !== undefined) {
					throw ApplicationError.emailAlreadyInUse(email.value);
				}
				const createdUser = new User({
					id: this.dependencies.createId(),
					email,
					passwordHash,
					firstName: input.firstName,
					lastName: input.lastName,
					createdAt: occurredAt,
					updatedAt: occurredAt,
				});
				const timestamp = Timestamp.from(occurredAt);
				const wallet = new Wallet({
					id: this.dependencies.createId(),
					userId: createdUser.id,
					balance: Money.of(0, "USD"),
					createdAt: timestamp,
					updatedAt: timestamp,
				});
				await context.users.save(createdUser);
				await context.wallets.save(wallet);
				return createdUser;
			},
		);

		return {
			token: await this.dependencies.tokenIssuer.issue({ userId: user.id }),
			user: toAuthenticationUser(user),
		};
	}
}

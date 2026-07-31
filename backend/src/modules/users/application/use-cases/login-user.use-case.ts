import type { AtomicWriteBoundary } from "../../../../shared/application/atomic-write-boundary.js";
import { ApplicationError } from "../../../../shared/application/errors/application.errors.js";
import { requiredSecret } from "../../../../shared/application/required-secret.js";
import { Email } from "../../domain/value-objects/email.js";
import {
	type AuthenticationUser,
	toAuthenticationUser,
} from "../authentication-user.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { TokenIssuer } from "../ports/token-issuer.js";

export interface LoginUserInput {
	email: string;
	password: string;
}

export interface LoginUserResult {
	token: string;
	user: AuthenticationUser;
}

export interface LoginUserDependencies {
	atomicWriteBoundary: AtomicWriteBoundary;
	passwordHasher: PasswordHasher;
	tokenIssuer: TokenIssuer;
}

export class LoginUserUseCase {
	public constructor(private readonly dependencies: LoginUserDependencies) {}

	public async execute(input: LoginUserInput): Promise<LoginUserResult> {
		const email = Email.of(input.email);
		const password = requiredSecret("password", input.password);
		const user = await this.dependencies.atomicWriteBoundary.execute(
			async (context) => {
				const foundUser = await context.users.findByEmail(email);
				const verified = await this.dependencies.passwordHasher.verify(
					password,
					foundUser?.passwordHash,
				);
				if (foundUser === undefined || !verified) {
					throw ApplicationError.invalidCredentials();
				}
				return foundUser;
			},
		);

		return {
			token: await this.dependencies.tokenIssuer.issue({ userId: user.id }),
			user: toAuthenticationUser(user),
		};
	}
}

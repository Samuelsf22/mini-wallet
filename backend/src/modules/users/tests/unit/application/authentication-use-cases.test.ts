import { describe, expect, it } from "vitest";
import type {
	AtomicWriteBoundary,
	AtomicWriteContext,
} from "../../../../../shared/application/atomic-write-boundary.js";
import { ApplicationError } from "../../../../../shared/application/errors/application.errors.js";
import { Money } from "../../../../../shared/domain/value-objects/money.js";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.js";
import type { WalletRepository } from "../../../../wallets/application/ports/wallet-repository.js";
import type { Wallet } from "../../../../wallets/domain/entities/wallet.js";
import type { PasswordHasher } from "../../../application/ports/password-hasher.js";
import type { TokenIssuer } from "../../../application/ports/token-issuer.js";
import type { UserRepository } from "../../../application/ports/user-repository.js";
import { LoginUserUseCase } from "../../../application/use-cases/login-user.use-case.js";
import { RegisterUserUseCase } from "../../../application/use-cases/register-user.use-case.js";
import { User } from "../../../domain/entities/user.js";
import { Email } from "../../../domain/value-objects/email.js";

const IDs = {
	user: Uuid.of("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
	wallet: Uuid.of("11111111-1111-1111-1111-111111111111"),
};
const fixedClock = () => new Date("2026-08-01T12:00:00.000Z");

describe("authentication use cases", () => {
	it("registers a normalized user with a hashed password and zero-balance USD wallet", async () => {
		const boundary = new AuthenticationBoundary();
		const hasher = new FakePasswordHasher();
		const issuer = new FakeTokenIssuer();

		const result = await registerUseCase(boundary, hasher, issuer).execute({
			email: " New.User@Example.com ",
			password: "plain-password",
			firstName: " New ",
			lastName: " User ",
		});

		expect(result).toMatchObject({
			token: "token-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		});
		expect(result.user).toEqual({
			id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
			email: "new.user@example.com",
			firstName: "New",
			lastName: "User",
		});
		expect(result.user).not.toHaveProperty("passwordHash");
		expect(hasher.hashCalls).toEqual(["plain-password"]);
		expect(boundary.userByEmail("new.user@example.com")?.passwordHash).toBe(
			"hashed:plain-password",
		);
		expect(boundary.userByEmail("new.user@example.com")?.passwordHash).not.toBe(
			"plain-password",
		);
		expect(boundary.walletFor(IDs.user)).toMatchObject({
			currency: "USD",
			balance: Money.of(0, "USD"),
		});
		expect(issuer.events).toEqual(["issue"]);
	});

	it("rejects a normalized duplicate email before creating a wallet", async () => {
		const boundary = new AuthenticationBoundary([existingUser()]);
		const hasher = new FakePasswordHasher();
		const issuer = new FakeTokenIssuer();

		await expect(
			registerUseCase(boundary, hasher, issuer).execute({
				email: " EXISTING@EXAMPLE.COM ",
				password: "plain-password",
				firstName: "New",
				lastName: "User",
			}),
		).rejects.toMatchObject({ code: "EMAIL_ALREADY_IN_USE" });
		expect(boundary.walletCount).toBe(0);
		expect(issuer.events).toEqual([]);
	});

	it("rolls back user creation when wallet persistence fails", async () => {
		const boundary = new AuthenticationBoundary([], "wallet");
		const issuer = new FakeTokenIssuer();

		await expect(
			registerUseCase(boundary, new FakePasswordHasher(), issuer).execute(
				registrationInput(),
			),
		).rejects.toThrow("Injected wallet write failure.");
		expect(boundary.userByEmail("new.user@example.com")).toBeUndefined();
		expect(boundary.walletCount).toBe(0);
		expect(issuer.events).toEqual([]);
	});

	it("rolls back wallet creation when user persistence fails", async () => {
		const boundary = new AuthenticationBoundary([], "user");

		await expect(
			registerUseCase(
				boundary,
				new FakePasswordHasher(),
				new FakeTokenIssuer(),
			).execute(registrationInput()),
		).rejects.toThrow("Injected user write failure.");
		expect(boundary.userByEmail("new.user@example.com")).toBeUndefined();
		expect(boundary.walletCount).toBe(0);
	});

	it("issues a token only after a successful password verification", async () => {
		const boundary = new AuthenticationBoundary([existingUser()]);
		const hasher = new FakePasswordHasher(true);
		const issuer = new FakeTokenIssuer(hasher.events);

		const result = await loginUseCase(boundary, hasher, issuer).execute({
			email: " EXISTING@EXAMPLE.COM ",
			password: "plain-password",
		});

		expect(result.token).toBe("token-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
		expect(hasher.events).toEqual(["verify", "issue"]);
	});

	it("rejects invalid passwords without exposing their value", async () => {
		const password = "secret-value-must-not-appear";
		const error = await applicationErrorOf(
			loginUseCase(
				new AuthenticationBoundary([existingUser()]),
				new FakePasswordHasher(),
				new FakeTokenIssuer(),
			).execute({
				email: "existing@example.com",
				password: { password } as unknown as string,
			}),
		);

		expect(error).toMatchObject({
			code: "INVALID_INPUT",
			message: "password is invalid.",
			details: { field: "password" },
		});
		expect(JSON.stringify(error)).not.toContain(password);
		expect(JSON.stringify(error.details)).not.toContain(password);
	});

	it("returns the same safe error for missing and invalid credentials", async () => {
		const boundary = new AuthenticationBoundary([existingUser()]);
		const hasher = new FakePasswordHasher(false);
		const issuer = new FakeTokenIssuer();
		const useCase = loginUseCase(boundary, hasher, issuer);

		const missing = await applicationErrorOf(
			useCase.execute({
				email: "missing@example.com",
				password: "plain-password",
			}),
		);
		const invalid = await applicationErrorOf(
			useCase.execute({
				email: "existing@example.com",
				password: "wrong-password",
			}),
		);

		expect({ code: missing.code, message: missing.message }).toEqual({
			code: "INVALID_CREDENTIALS",
			message: "Invalid email or password.",
		});
		expect({ code: invalid.code, message: invalid.message }).toEqual({
			code: "INVALID_CREDENTIALS",
			message: "Invalid email or password.",
		});
		expect(issuer.events).toEqual([]);
		expect(hasher.events).toEqual(["verify", "verify"]);
		expect(hasher.verifyCalls).toEqual([
			{ password: "plain-password", passwordHash: undefined },
			{ password: "wrong-password", passwordHash: "hashed:plain-password" },
		]);
	});
});

function registerUseCase(
	boundary: AtomicWriteBoundary,
	passwordHasher: PasswordHasher,
	tokenIssuer: TokenIssuer,
): RegisterUserUseCase {
	return new RegisterUserUseCase({
		atomicWriteBoundary: boundary,
		passwordHasher,
		tokenIssuer,
		createId: createIdGenerator(IDs.user, IDs.wallet),
		clock: fixedClock,
	});
}

function loginUseCase(
	boundary: AtomicWriteBoundary,
	passwordHasher: PasswordHasher,
	tokenIssuer: TokenIssuer,
): LoginUserUseCase {
	return new LoginUserUseCase({
		atomicWriteBoundary: boundary,
		passwordHasher,
		tokenIssuer,
	});
}

function registrationInput() {
	return {
		email: "new.user@example.com",
		password: "plain-password",
		firstName: "New",
		lastName: "User",
	};
}

function existingUser(): User {
	return new User({
		id: IDs.user,
		email: Email.of("existing@example.com"),
		passwordHash: "hashed:plain-password",
		firstName: "Existing",
		lastName: "User",
		createdAt: fixedClock(),
		updatedAt: fixedClock(),
	});
}

function createIdGenerator(...ids: Uuid[]): () => Uuid {
	let index = 0;
	return () => {
		const id = ids[index];
		if (id === undefined) throw new Error("Test ID generator exhausted.");
		index += 1;
		return id;
	};
}

async function applicationErrorOf(
	operation: Promise<unknown>,
): Promise<ApplicationError> {
	try {
		await operation;
		throw new Error("Expected an application error.");
	} catch (error) {
		if (error instanceof ApplicationError) return error;
		throw error;
	}
}

class FakePasswordHasher implements PasswordHasher {
	public readonly hashCalls: string[] = [];
	public readonly events: string[] = [];
	public readonly verifyCalls: {
		password: string;
		passwordHash: string | undefined;
	}[] = [];

	public constructor(private readonly verificationResult = true) {}

	public async hash(password: string): Promise<string> {
		this.hashCalls.push(password);
		return `hashed:${password}`;
	}

	public async verify(
		password: string,
		passwordHash: string | undefined,
	): Promise<boolean> {
		this.events.push("verify");
		this.verifyCalls.push({ password, passwordHash });
		return this.verificationResult && passwordHash === `hashed:${password}`;
	}
}

class FakeTokenIssuer implements TokenIssuer {
	public readonly events: string[];

	public constructor(events: string[] = []) {
		this.events = events;
	}

	public async issue(subject: { userId: Uuid }): Promise<string> {
		this.events.push("issue");
		return `token-${subject.userId.value}`;
	}
}

class AuthenticationBoundary implements AtomicWriteBoundary {
	private usersByEmail = new Map<string, User>();
	private walletsByUserId = new Map<string, Wallet>();

	public constructor(
		users: User[] = [],
		private readonly failOn?: "user" | "wallet",
	) {
		for (const user of users) this.usersByEmail.set(user.email.value, user);
	}

	public async execute<T>(
		operation: (context: AtomicWriteContext) => Promise<T>,
	): Promise<T> {
		const stagedUsers = new Map(this.usersByEmail);
		const stagedWallets = new Map(this.walletsByUserId);
		const users: UserRepository = {
			findByEmail: async (email) => stagedUsers.get(email.value),
			save: async (user) => {
				if (this.failOn === "user")
					throw new Error("Injected user write failure.");
				stagedUsers.set(user.email.value, user);
			},
		};
		const wallets: WalletRepository = {
			findByUserId: async (userId) => stagedWallets.get(userId.value),
			save: async (wallet) => {
				if (this.failOn === "wallet")
					throw new Error("Injected wallet write failure.");
				stagedWallets.set(wallet.userId.value, wallet);
			},
		};
		const context = { users, wallets } as AtomicWriteContext;
		const result = await operation(context);
		this.usersByEmail = stagedUsers;
		this.walletsByUserId = stagedWallets;
		return result;
	}

	public userByEmail(email: string): User | undefined {
		return this.usersByEmail.get(email);
	}

	public walletFor(userId: Uuid): Wallet | undefined {
		return this.walletsByUserId.get(userId.value);
	}

	public get walletCount(): number {
		return this.walletsByUserId.size;
	}
}

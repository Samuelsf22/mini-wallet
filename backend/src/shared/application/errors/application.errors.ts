export type ApplicationErrorCode =
	| "INVALID_INPUT"
	| "WALLET_NOT_FOUND"
	| "USER_NOT_FOUND"
	| "EMAIL_ALREADY_IN_USE"
	| "INVALID_CREDENTIALS"
	| "SAME_WALLET_TRANSFER"
	| "INVALID_IDEMPOTENCY_KEY"
	| "IDEMPOTENCY_CONFLICT";

export class ApplicationError extends Error {
	public readonly details: Readonly<Record<string, unknown>>;

	private constructor(
		public readonly code: ApplicationErrorCode,
		message: string,
		details: Record<string, unknown>,
	) {
		super(message);
		this.name = "ApplicationError";
		this.details = Object.freeze(details);
		Object.freeze(this);
	}

	public static invalidInput(field: string, value: unknown): ApplicationError {
		return new ApplicationError("INVALID_INPUT", `${field} is invalid.`, {
			field,
			value,
		});
	}

	public static invalidSecretInput(field: string): ApplicationError {
		return new ApplicationError("INVALID_INPUT", `${field} is invalid.`, {
			field,
		});
	}

	public static walletNotFound(walletId: string): ApplicationError {
		return new ApplicationError("WALLET_NOT_FOUND", "Wallet was not found.", {
			walletId,
		});
	}

	public static userNotFound(email: string): ApplicationError {
		return new ApplicationError("USER_NOT_FOUND", "User was not found.", {
			email,
		});
	}

	public static emailAlreadyInUse(email: string): ApplicationError {
		return new ApplicationError(
			"EMAIL_ALREADY_IN_USE",
			"Email is already in use.",
			{ email },
		);
	}

	public static invalidCredentials(): ApplicationError {
		return new ApplicationError(
			"INVALID_CREDENTIALS",
			"Invalid email or password.",
			{},
		);
	}

	public static sameWalletTransfer(walletId: string): ApplicationError {
		return new ApplicationError(
			"SAME_WALLET_TRANSFER",
			"A transfer requires distinct source and target wallets.",
			{ walletId },
		);
	}

	public static idempotencyConflict(key: string): ApplicationError {
		return new ApplicationError(
			"IDEMPOTENCY_CONFLICT",
			"Idempotency key was already used for a different transfer.",
			{ key },
		);
	}

	public static invalidIdempotencyKey(
		keyLength: number,
		maxLength: number,
	): ApplicationError {
		return new ApplicationError(
			"INVALID_IDEMPOTENCY_KEY",
			`Idempotency key must not exceed ${maxLength} characters.`,
			{ keyLength, maxLength },
		);
	}
}

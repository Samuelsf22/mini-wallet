export type ApplicationErrorCode =
	| "INVALID_INPUT"
	| "WALLET_NOT_FOUND"
	| "USER_NOT_FOUND"
	| "SAME_WALLET_TRANSFER"
	| "TRANSFER_IN_PROGRESS"
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

	public static transferInProgress(key: string): ApplicationError {
		return new ApplicationError(
			"TRANSFER_IN_PROGRESS",
			"Transfer with this idempotency key is already in progress.",
			{ key },
		);
	}
}

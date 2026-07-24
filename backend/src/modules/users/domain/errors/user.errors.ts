export type UserErrorCode =
	| "INVALID_EMAIL"
	| "INVALID_PASSWORD_HASH"
	| "INVALID_NAME"
	| "INVALID_DATE";

export type UserErrorDetails = Readonly<
	| { value: unknown }
	| { field: "passwordHash" }
	| { field: "firstName" | "lastName"; value: unknown }
	| { field: "createdAt" | "updatedAt"; value: unknown }
>;

export class UserError extends Error {
	public readonly details?: UserErrorDetails;

	private constructor(
		public readonly code: UserErrorCode,
		message: string,
		details?: UserErrorDetails,
	) {
		super(message);
		this.name = "UserError";
		if (details !== undefined) {
			this.details = Object.freeze(details);
		}
	}

	public static invalidEmail(value: unknown): UserError {
		return new UserError(
			"INVALID_EMAIL",
			`Email must be a valid address. Received: ${String(value)}.`,
			{ value },
		);
	}

	public static invalidPasswordHash(): UserError {
		return new UserError(
			"INVALID_PASSWORD_HASH",
			"Password hash must be a non-empty string.",
			{ field: "passwordHash" },
		);
	}

	public static invalidName(
		field: "firstName" | "lastName",
		value: unknown,
	): UserError {
		return new UserError(
			"INVALID_NAME",
			`${field} must be a non-empty string. Received: ${String(value)}.`,
			{ field, value },
		);
	}

	public static invalidDate(
		field: "createdAt" | "updatedAt",
		value: unknown,
	): UserError {
		return new UserError(
			"INVALID_DATE",
			`${field} must be a valid Date. Received: ${String(value)}.`,
			{ field, value },
		);
	}
}

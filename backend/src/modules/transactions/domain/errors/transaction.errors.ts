export type TransactionErrorCode =
	| "INVALID_TYPE"
	| "INVALID_REFERENCE"
	| "INVALID_DATE"
	| "INVALID_TEXT";

export type TransactionErrorDetails = Readonly<
	{ value: unknown } | { field: "counterparty" | "description"; value: unknown }
>;

export class TransactionError extends Error {
	public readonly details: TransactionErrorDetails;

	private constructor(
		public readonly code: TransactionErrorCode,
		message: string,
		details: TransactionErrorDetails,
	) {
		super(message);
		this.name = "TransactionError";
		this.details = Object.freeze(details);
	}

	public static invalidType(value: unknown): TransactionError {
		return new TransactionError(
			"INVALID_TYPE",
			`Transaction type must be CREDIT or DEBIT. Received: ${String(value)}.`,
			{ value },
		);
	}

	public static invalidReference(value: unknown): TransactionError {
		return new TransactionError(
			"INVALID_REFERENCE",
			`Transaction reference must be a non-empty string. Received: ${String(value)}.`,
			{ value },
		);
	}

	public static invalidDate(value: unknown): TransactionError {
		return new TransactionError(
			"INVALID_DATE",
			`Transaction createdAt must be a valid Date. Received: ${String(value)}.`,
			{ value },
		);
	}

	public static invalidText(
		field: "counterparty" | "description",
		value: unknown,
	): TransactionError {
		return new TransactionError(
			"INVALID_TEXT",
			`${field} must be a string when provided. Received: ${String(value)}.`,
			{ field, value },
		);
	}
}

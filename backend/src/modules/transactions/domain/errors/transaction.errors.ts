export class InvalidTransactionTypeError extends Error {
	public constructor(public readonly value: unknown) {
		super(
			`Transaction type must be CREDIT or DEBIT. Received: ${String(value)}.`,
		);
		this.name = "InvalidTransactionTypeError";
	}
}

export class InvalidTransactionReferenceError extends Error {
	public constructor(public readonly value: unknown) {
		super(
			`Transaction reference must be a non-empty string. Received: ${String(value)}.`,
		);
		this.name = "InvalidTransactionReferenceError";
	}
}

export class InvalidTransactionDateError extends Error {
	public constructor(public readonly value: unknown) {
		super(
			`Transaction createdAt must be a valid Date. Received: ${String(value)}.`,
		);
		this.name = "InvalidTransactionDateError";
	}
}

export class InvalidTransactionTextError extends Error {
	public constructor(
		public readonly field: "counterparty" | "description",
		public readonly value: unknown,
	) {
		super(
			`${field} must be a string when provided. Received: ${String(value)}.`,
		);
		this.name = "InvalidTransactionTextError";
	}
}

export class InvalidEmailError extends Error {
	public constructor(public readonly value: unknown) {
		super(`Email must be a valid address. Received: ${String(value)}.`);
		this.name = "InvalidEmailError";
	}
}

export class InvalidPasswordHashError extends Error {
	public constructor() {
		super("Password hash must be a non-empty string.");
		this.name = "InvalidPasswordHashError";
	}
}

export class InvalidUserNameError extends Error {
	public constructor(
		public readonly field: "firstName" | "lastName",
		public readonly value: unknown,
	) {
		super(`${field} must be a non-empty string. Received: ${String(value)}.`);
		this.name = "InvalidUserNameError";
	}
}

export class InvalidUserDateError extends Error {
	public constructor(
		public readonly field: "createdAt" | "updatedAt",
		public readonly value: unknown,
	) {
		super(`${field} must be a valid Date. Received: ${String(value)}.`);
		this.name = "InvalidUserDateError";
	}
}

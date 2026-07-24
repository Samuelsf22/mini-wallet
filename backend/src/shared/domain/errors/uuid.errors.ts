export class InvalidUuidError extends Error {
	public constructor(public readonly value: unknown) {
		super(
			`UUID must be a canonical lowercase UUID string. Received: ${String(value)}.`,
		);
		this.name = "InvalidUuidError";
	}
}

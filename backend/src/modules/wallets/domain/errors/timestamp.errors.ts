export class InvalidTimestampError extends Error {
	public constructor(public readonly value: unknown) {
		super(`Timestamp must be a valid Date. Received: ${String(value)}.`);
		this.name = "InvalidTimestampError";
	}
}

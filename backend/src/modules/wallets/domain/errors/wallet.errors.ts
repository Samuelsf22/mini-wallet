export type WalletErrorCode = "INVALID_TIMESTAMP";

export class WalletError extends Error {
	public readonly code: WalletErrorCode = "INVALID_TIMESTAMP";
	public readonly details: Readonly<{ value: unknown }>;

	private constructor(value: unknown) {
		super(`Timestamp must be a valid Date. Received: ${String(value)}.`);
		this.name = "WalletError";
		this.details = Object.freeze({ value });
	}

	public static invalidTimestamp(value: unknown): WalletError {
		return new WalletError(value);
	}
}

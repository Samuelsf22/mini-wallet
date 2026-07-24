export type UuidErrorCode = "INVALID_UUID";

export class UuidError extends Error {
	public readonly details: Readonly<{ value: unknown }>;

	private constructor(value: unknown) {
		super(
			`UUID must be a canonical lowercase UUID string. Received: ${String(value)}.`,
		);
		this.name = "UuidError";
		this.code = "INVALID_UUID" as const;
		this.details = Object.freeze({ value });
	}

	public readonly code: UuidErrorCode;

	public static invalid(value: unknown): UuidError {
		return new UuidError(value);
	}
}

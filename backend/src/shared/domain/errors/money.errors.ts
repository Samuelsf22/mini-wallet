export type MoneyErrorCode =
	| "INVALID_MINOR_UNITS"
	| "INVALID_CURRENCY"
	| "CURRENCY_MISMATCH"
	| "INSUFFICIENT_FUNDS"
	| "AMOUNT_OVERFLOW";

export type MoneyErrorDetails = Readonly<
	| { minorUnits: number; currency: string }
	| { expected: string; actual: string }
	| { availableMinorUnits: number; requestedMinorUnits: number }
	| { leftMinorUnits: number; rightMinorUnits: number; currency: string }
>;

export class MoneyError extends Error {
	public readonly details?: MoneyErrorDetails;

	private constructor(
		public readonly code: MoneyErrorCode,
		message: string,
		details?: MoneyErrorDetails,
	) {
		super(message);
		this.name = "MoneyError";
		if (details !== undefined) {
			this.details = Object.freeze(details);
		}
	}

	public static invalidMinorUnits(
		minorUnits: number,
		currency: string,
	): MoneyError {
		return new MoneyError(
			"INVALID_MINOR_UNITS",
			`Invalid money: minor units must be a non-negative safe integer. Context: minorUnits=${String(minorUnits)}, currency=${String(currency)}.`,
			{ minorUnits, currency },
		);
	}

	public static invalidCurrency(
		minorUnits: number,
		currency: string,
	): MoneyError {
		return new MoneyError(
			"INVALID_CURRENCY",
			`Invalid money: currency must be a three-letter uppercase ISO-style code. Context: minorUnits=${String(minorUnits)}, currency=${String(currency)}.`,
			{ minorUnits, currency },
		);
	}

	public static currencyMismatch(expected: string, actual: string): MoneyError {
		return new MoneyError(
			"CURRENCY_MISMATCH",
			`Currencies must match: expected ${expected}, received ${actual}.`,
			{ expected, actual },
		);
	}

	public static insufficientFunds(
		availableMinorUnits: number,
		requestedMinorUnits: number,
	): MoneyError {
		return new MoneyError(
			"INSUFFICIENT_FUNDS",
			`Insufficient funds: ${requestedMinorUnits} minor units requested, but only ${availableMinorUnits} available.`,
			{ availableMinorUnits, requestedMinorUnits },
		);
	}

	public static amountOverflow(
		leftMinorUnits: number,
		rightMinorUnits: number,
		currency: string,
	): MoneyError {
		return new MoneyError(
			"AMOUNT_OVERFLOW",
			`Money addition exceeds Number.MAX_SAFE_INTEGER: ${leftMinorUnits} + ${rightMinorUnits} ${currency}.`,
			{ leftMinorUnits, rightMinorUnits, currency },
		);
	}
}

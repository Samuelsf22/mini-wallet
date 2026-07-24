export class InvalidMoneyError extends Error {
	public constructor(
		public readonly reason: string,
		public readonly context: Readonly<{
			minorUnits?: number;
			currency?: string;
		}>,
	) {
		super(
			`Invalid money: ${reason}. Context: minorUnits=${String(context.minorUnits)}, currency=${String(context.currency)}.`,
		);
		this.name = "InvalidMoneyError";
	}
}

export class CurrencyMismatchError extends Error {
	public constructor(
		public readonly expected: string,
		public readonly actual: string,
	) {
		super(`Currencies must match: expected ${expected}, received ${actual}.`);
		this.name = "CurrencyMismatchError";
	}
}

export class InsufficientFundsError extends Error {
	public constructor(
		public readonly availableMinorUnits: number,
		public readonly requestedMinorUnits: number,
	) {
		super(
			`Insufficient funds: ${requestedMinorUnits} minor units requested, but only ${availableMinorUnits} available.`,
		);
		this.name = "InsufficientFundsError";
	}
}

export class MoneyOverflowError extends Error {
	public constructor(
		public readonly leftMinorUnits: number,
		public readonly rightMinorUnits: number,
		public readonly currency: string,
	) {
		super(
			`Money addition exceeds Number.MAX_SAFE_INTEGER: ${leftMinorUnits} + ${rightMinorUnits} ${currency}.`,
		);
		this.name = "MoneyOverflowError";
	}
}

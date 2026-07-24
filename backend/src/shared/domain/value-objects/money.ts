import { MoneyError } from "../errors/money.errors.js";

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const MAX_MINOR_UNITS = Number.MAX_SAFE_INTEGER;

export class Money {
	private constructor(
		public readonly minorUnits: number,
		public readonly currency: string,
	) {
		Object.freeze(this);
	}

	public static of(minorUnits: number, currency: string): Money {
		if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
			throw MoneyError.invalidMinorUnits(minorUnits, currency);
		}

		if (!CURRENCY_CODE_PATTERN.test(currency)) {
			throw MoneyError.invalidCurrency(minorUnits, currency);
		}

		return new Money(minorUnits, currency);
	}

	public equals(other: Money): boolean {
		return (
			this.minorUnits === other.minorUnits && this.currency === other.currency
		);
	}

	public compareTo(other: Money): number {
		this.assertSameCurrency(other);
		return this.minorUnits - other.minorUnits;
	}

	public add(other: Money): Money {
		this.assertSameCurrency(other);
		if (other.minorUnits > MAX_MINOR_UNITS - this.minorUnits) {
			throw MoneyError.amountOverflow(
				this.minorUnits,
				other.minorUnits,
				this.currency,
			);
		}

		return Money.of(this.minorUnits + other.minorUnits, this.currency);
	}

	public subtract(other: Money): Money {
		this.assertSameCurrency(other);

		if (other.minorUnits > this.minorUnits) {
			throw MoneyError.insufficientFunds(this.minorUnits, other.minorUnits);
		}

		return Money.of(this.minorUnits - other.minorUnits, this.currency);
	}

	private assertSameCurrency(other: Money): void {
		if (this.currency !== other.currency) {
			throw MoneyError.currencyMismatch(this.currency, other.currency);
		}
	}
}

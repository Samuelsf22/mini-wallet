import { WalletError } from "../errors/wallet.errors.js";

export class Timestamp {
	private constructor(private readonly value: Date) {
		Object.freeze(this);
	}

	public static from(value: Date): Timestamp {
		if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
			throw WalletError.invalidTimestamp(value);
		}

		return new Timestamp(new Date(value));
	}

	public static now(clock: () => Date = () => new Date()): Timestamp {
		return Timestamp.from(clock());
	}

	public toDate(): Date {
		return new Date(this.value);
	}
}

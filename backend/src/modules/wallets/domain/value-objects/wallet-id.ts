import { Uuid } from "./uuid.js";

export class WalletId {
	private constructor(private readonly uuid: Uuid) {
		Object.freeze(this);
	}

	public static of(value: string): WalletId {
		return new WalletId(Uuid.of(value));
	}

	public get value(): string {
		return this.uuid.value;
	}

	public equals(other: WalletId): boolean {
		return this.uuid.equals(other.uuid);
	}

	public toString(): string {
		return this.uuid.toString();
	}
}

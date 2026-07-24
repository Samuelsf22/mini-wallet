import { Uuid } from "./uuid.js";

export class UserId {
	private constructor(private readonly uuid: Uuid) {
		Object.freeze(this);
	}

	public static of(value: string): UserId {
		return new UserId(Uuid.of(value));
	}

	public get value(): string {
		return this.uuid.value;
	}

	public equals(other: UserId): boolean {
		return this.uuid.equals(other.uuid);
	}

	public toString(): string {
		return this.uuid.toString();
	}
}

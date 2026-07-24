import { InvalidUuidError } from "../errors/uuid.errors.js";

const CANONICAL_UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class Uuid {
	private constructor(public readonly value: string) {
		Object.freeze(this);
	}

	public static of(value: string): Uuid {
		if (typeof value !== "string" || !CANONICAL_UUID_PATTERN.test(value)) {
			throw new InvalidUuidError(value);
		}

		return new Uuid(value);
	}

	public equals(other: Uuid): boolean {
		return this.value === other.value;
	}

	public toString(): string {
		return this.value;
	}
}

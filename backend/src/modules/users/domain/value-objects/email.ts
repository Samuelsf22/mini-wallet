import { UserError } from "../errors/user.errors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export class Email {
	private constructor(public readonly value: string) {
		Object.freeze(this);
	}

	public static of(value: string): Email {
		if (typeof value !== "string") {
			throw UserError.invalidEmail(value);
		}

		const normalizedValue = value.trim().toLowerCase();

		if (!EMAIL_PATTERN.test(normalizedValue)) {
			throw UserError.invalidEmail(value);
		}

		return new Email(normalizedValue);
	}

	public equals(other: Email): boolean {
		return this.value === other.value;
	}

	public toString(): string {
		return this.value;
	}
}

import type { Uuid } from "../../../../shared/domain/value-objects/uuid.js";
import {
	InvalidPasswordHashError,
	InvalidUserDateError,
	InvalidUserNameError,
} from "../errors/user.errors.js";
import type { Email } from "../value-objects/email.js";

export interface UserProps {
	id: Uuid;
	email: Email;
	passwordHash: string;
	firstName: string;
	lastName: string;
	createdAt: Date;
	updatedAt: Date;
}

export class User {
	private _email: Email;
	private _updatedAt: Date;

	public constructor({
		id,
		email,
		passwordHash,
		firstName,
		lastName,
		createdAt,
		updatedAt,
	}: UserProps) {
		if (typeof passwordHash !== "string" || passwordHash.trim() === "") {
			throw new InvalidPasswordHashError();
		}

		this.id = id;
		this._email = email;
		this.passwordHash = passwordHash;
		this.firstName = normalizeName("firstName", firstName);
		this.lastName = normalizeName("lastName", lastName);
		this._createdAt = cloneValidDate("createdAt", createdAt);
		this._updatedAt = cloneValidDate("updatedAt", updatedAt);
	}

	public readonly id: Uuid;
	public readonly passwordHash: string;
	public readonly firstName: string;
	public readonly lastName: string;
	private readonly _createdAt: Date;

	public get email(): Email {
		return this._email;
	}

	public get fullName(): string {
		return `${this.firstName} ${this.lastName}`;
	}

	public get createdAt(): Date {
		return new Date(this._createdAt);
	}

	public get updatedAt(): Date {
		return new Date(this._updatedAt);
	}

	public changeEmail(email: Email, changedAt: Date = new Date()): void {
		const updatedAt = cloneValidDate("updatedAt", changedAt);

		this._email = email;
		this._updatedAt = updatedAt;
	}
}

function normalizeName(
	field: "firstName" | "lastName",
	value: unknown,
): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new InvalidUserNameError(field, value);
	}

	return value.trim();
}

function cloneValidDate(
	field: "createdAt" | "updatedAt",
	value: unknown,
): Date {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new InvalidUserDateError(field, value);
	}

	return new Date(value);
}

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { PasswordHasher } from "../../modules/users/application/ports/password-hasher.js";

const VERSION = "scrypt-v1";
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 32 * 1024 * 1024;
const DUMMY_SALT = Buffer.from("n0uNOmwefwKaXUyLDj9qHQ", "base64url");
const DUMMY_KEY = Buffer.from(
	"sQvtZS7h1jRbTWXMLa3IaQavzMzpIoF4F-xyUm7pvjogo0DwAx4otluOAcfuJZCnRHyscLEjU2Pg3NhaKJz6LQ",
	"base64url",
);

export interface ScryptPasswordHasherOptions {
	randomBytes?: (size: number) => Buffer;
}

export class ScryptPasswordHasher implements PasswordHasher {
	private readonly random: (size: number) => Buffer;

	public constructor(options: ScryptPasswordHasherOptions = {}) {
		this.random = options.randomBytes ?? randomBytes;
	}

	public async hash(password: string): Promise<string> {
		const salt = this.random(SALT_LENGTH);
		if (salt.byteLength !== SALT_LENGTH) {
			throw new Error("Password salt generator returned an invalid length.");
		}
		const key = await deriveKey(password, salt);
		return [
			VERSION,
			String(COST),
			String(BLOCK_SIZE),
			String(PARALLELIZATION),
			salt.toString("base64url"),
			key.toString("base64url"),
		].join("$");
	}

	public async verify(
		password: string,
		passwordHash: string | undefined,
	): Promise<boolean> {
		const parsed =
			passwordHash === undefined ? undefined : parseHash(passwordHash);
		const expected = parsed ?? { salt: DUMMY_SALT, key: DUMMY_KEY };
		const candidate = await deriveKey(password, expected.salt);
		return timingSafeEqual(candidate, expected.key) && parsed !== undefined;
	}
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			password,
			salt,
			KEY_LENGTH,
			{
				N: COST,
				r: BLOCK_SIZE,
				p: PARALLELIZATION,
				maxmem: MAX_MEMORY,
			},
			(error, derivedKey) => {
				if (error !== null) {
					reject(error);
					return;
				}
				resolve(derivedKey);
			},
		);
	});
}

function parseHash(value: string): { salt: Buffer; key: Buffer } | undefined {
	const parts = value.split("$");
	if (
		parts.length !== 6 ||
		parts[0] !== VERSION ||
		parts[1] !== String(COST) ||
		parts[2] !== String(BLOCK_SIZE) ||
		parts[3] !== String(PARALLELIZATION)
	) {
		return undefined;
	}
	const salt = decodeBase64Url(parts[4]);
	const key = decodeBase64Url(parts[5]);
	if (
		salt === undefined ||
		key === undefined ||
		salt.byteLength !== SALT_LENGTH ||
		key.byteLength !== KEY_LENGTH
	) {
		return undefined;
	}

	return { salt, key };
}

function decodeBase64Url(value: string | undefined): Buffer | undefined {
	if (value === undefined || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
	const decoded = Buffer.from(value, "base64url");
	return decoded.toString("base64url") === value ? decoded : undefined;
}

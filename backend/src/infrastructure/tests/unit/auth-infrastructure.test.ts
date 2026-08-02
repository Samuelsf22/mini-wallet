import { decodeJwt, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { Uuid } from "../../../shared/domain/value-objects/uuid.js";
import { JwtTokenService } from "../../auth/jwt-token-service.js";
import { ScryptPasswordHasher } from "../../auth/scrypt-password-hasher.js";
import { type AuthConfig, readAuthConfig } from "../../config/auth.config.js";

const deterministicTestJwtKey = new Uint8Array(Buffer.alloc(32));
const fixedClock = () => new Date("2026-08-02T12:00:00.000Z");
const subject = { userId: Uuid.of("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") };

describe("ScryptPasswordHasher", () => {
	it("uses a distinct random salt for each password hash", async () => {
		const salts = [Buffer.alloc(16, 1), Buffer.alloc(16, 2)];
		const hasher = new ScryptPasswordHasher({
			randomBytes: () => {
				const salt = salts.shift();
				if (salt === undefined) throw new Error("No test salt available.");
				return salt;
			},
		});

		const first = await hasher.hash("password");
		const second = await hasher.hash("password");

		expect(first).not.toBe(second);
		expect(await hasher.verify("password", first)).toBe(true);
	});

	it("verifies correct passwords and safely rejects wrong, missing, and malformed hashes", async () => {
		const hasher = new ScryptPasswordHasher({
			randomBytes: () => Buffer.alloc(16, 3),
		});
		const hash = await hasher.hash("password");

		expect(await hasher.verify("password", hash)).toBe(true);
		expect(await hasher.verify("wrong-password", hash)).toBe(false);
		expect(await hasher.verify("password", undefined)).toBe(false);
		expect(await hasher.verify("password", "not-a-valid-password-hash")).toBe(
			false,
		);
	});
});

describe("AuthConfig", () => {
	it("parses validated authentication configuration on demand", () => {
		const config = readAuthConfig(environment());

		expect(config).toMatchObject({
			issuer: "mini-wallet",
			audience: "mini-wallet-api",
			accessTokenTtlSeconds: 900,
		});
		expect(config.jwtSecret).toHaveLength(32);
	});

	it.each([
		[{ ...environment(), AUTH_JWT_SECRET: "too-short" }, "AUTH_JWT_SECRET"],
		[{ ...environment(), AUTH_JWT_ISSUER: " " }, "AUTH_JWT_ISSUER"],
		[{ ...environment(), AUTH_JWT_AUDIENCE: " " }, "AUTH_JWT_AUDIENCE"],
		[
			{ ...environment(), AUTH_ACCESS_TOKEN_TTL_SECONDS: "3601" },
			"AUTH_ACCESS_TOKEN_TTL_SECONDS",
		],
	])("rejects invalid configuration", (values, message) => {
		expect(() => readAuthConfig(values)).toThrow(message);
	});
});

describe("JwtTokenService", () => {
	it("issues HS256 access tokens with only the required claims", async () => {
		const service = new JwtTokenService(authConfig(), { clock: fixedClock });
		const token = await service.issue(subject);
		const payload = decodeJwt(token);

		expect(payload).toMatchObject({
			sub: subject.userId.value,
			iss: "mini-wallet",
			aud: "mini-wallet-api",
			iat: 1_785_672_000,
			exp: 1_785_672_900,
			token_type: "access",
			token_version: 1,
		});
		expect(payload).not.toHaveProperty("email");
		expect(payload).not.toHaveProperty("password");
		expect((await service.verify(token)).userId).toEqual(subject.userId);
	});

	it("rejects expired, missing-expiry, issuer, audience, algorithm, and subject violations", async () => {
		const issued = new JwtTokenService(authConfig(), { clock: fixedClock });
		const token = await issued.issue(subject);
		const expired = new JwtTokenService(authConfig(), {
			clock: () => new Date("2026-08-02T12:16:00.000Z"),
		});
		const wrongIssuer = new JwtTokenService(
			authConfig({ issuer: "other-issuer" }),
			{
				clock: fixedClock,
			},
		);
		const wrongAudience = new JwtTokenService(
			authConfig({ audience: "other-audience" }),
			{
				clock: fixedClock,
			},
		);
		const hs512 = await new SignJWT({ token_type: "access", token_version: 1 })
			.setProtectedHeader({ alg: "HS512", typ: "JWT" })
			.setSubject(subject.userId.value)
			.setIssuer("mini-wallet")
			.setAudience("mini-wallet-api")
			.setIssuedAt(1_785_672_000)
			.setExpirationTime(1_785_672_900)
			.sign(deterministicTestJwtKey);
		const missingExpiration = await new SignJWT({
			token_type: "access",
			token_version: 1,
		})
			.setProtectedHeader({ alg: "HS256", typ: "JWT" })
			.setSubject(subject.userId.value)
			.setIssuer("mini-wallet")
			.setAudience("mini-wallet-api")
			.setIssuedAt(1_785_672_000)
			.sign(deterministicTestJwtKey);
		const invalidSubject = await new SignJWT({
			token_type: "access",
			token_version: 1,
		})
			.setProtectedHeader({ alg: "HS256", typ: "JWT" })
			.setSubject("not-a-uuid")
			.setIssuer("mini-wallet")
			.setAudience("mini-wallet-api")
			.setIssuedAt(1_785_672_000)
			.setExpirationTime(1_785_672_900)
			.sign(deterministicTestJwtKey);

		for (const verifier of [expired, wrongIssuer, wrongAudience]) {
			await expect(verifier.verify(token)).rejects.toThrow(
				"Invalid access token.",
			);
		}
		await expect(issued.verify(hs512)).rejects.toThrow("Invalid access token.");
		await expect(issued.verify(missingExpiration)).rejects.toThrow(
			"Invalid access token.",
		);
		await expect(issued.verify(invalidSubject)).rejects.toThrow(
			"Invalid access token.",
		);
	});
});

function environment(): NodeJS.ProcessEnv {
	return {
		AUTH_JWT_SECRET: Buffer.from(deterministicTestJwtKey).toString("base64url"),
		AUTH_JWT_ISSUER: "mini-wallet",
		AUTH_JWT_AUDIENCE: "mini-wallet-api",
		AUTH_ACCESS_TOKEN_TTL_SECONDS: "900",
	};
}

function authConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
	return {
		jwtSecret: deterministicTestJwtKey,
		issuer: "mini-wallet",
		audience: "mini-wallet-api",
		accessTokenTtlSeconds: 900,
		...overrides,
	};
}

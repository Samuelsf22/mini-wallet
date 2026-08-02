const MINIMUM_JWT_SECRET_BYTES = 32;
const MAXIMUM_ACCESS_TOKEN_TTL_SECONDS = 3_600;

export interface AuthConfig {
	jwtSecret: Uint8Array;
	issuer: string;
	audience: string;
	accessTokenTtlSeconds: number;
}

export function readAuthConfig(environment: NodeJS.ProcessEnv): AuthConfig {
	return {
		jwtSecret: jwtSecret(environment.AUTH_JWT_SECRET),
		issuer: requiredEnvironmentValue(environment, "AUTH_JWT_ISSUER"),
		audience: requiredEnvironmentValue(environment, "AUTH_JWT_AUDIENCE"),
		accessTokenTtlSeconds: accessTokenTtlSeconds(
			environment.AUTH_ACCESS_TOKEN_TTL_SECONDS,
		),
	};
}

function jwtSecret(value: string | undefined): Uint8Array {
	const normalized = requiredEnvironmentValueValue(value, "AUTH_JWT_SECRET");
	if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
		throw new Error("AUTH_JWT_SECRET must be base64url encoded.");
	}
	const decoded = Buffer.from(normalized, "base64url");
	if (
		decoded.byteLength < MINIMUM_JWT_SECRET_BYTES ||
		decoded.toString("base64url") !== normalized
	) {
		throw new Error(
			`AUTH_JWT_SECRET must be a base64url-encoded secret of at least ${MINIMUM_JWT_SECRET_BYTES} bytes.`,
		);
	}

	return new Uint8Array(decoded);
}

function requiredEnvironmentValue(
	environment: NodeJS.ProcessEnv,
	name: string,
): string {
	return requiredEnvironmentValueValue(environment[name], name);
}

function requiredEnvironmentValueValue(
	value: string | undefined,
	name: string,
): string {
	const normalized = value?.trim();
	if (normalized === undefined || normalized === "") {
		throw new Error(`${name} must be a non-empty environment variable.`);
	}

	return normalized;
}

function accessTokenTtlSeconds(value: string | undefined): number {
	if (value === undefined || !/^\d+$/.test(value)) {
		throw new Error(
			`AUTH_ACCESS_TOKEN_TTL_SECONDS must be an integer between 1 and ${MAXIMUM_ACCESS_TOKEN_TTL_SECONDS}.`,
		);
	}
	const ttl = Number(value);
	if (
		!Number.isSafeInteger(ttl) ||
		ttl < 1 ||
		ttl > MAXIMUM_ACCESS_TOKEN_TTL_SECONDS
	) {
		throw new Error(
			`AUTH_ACCESS_TOKEN_TTL_SECONDS must be an integer between 1 and ${MAXIMUM_ACCESS_TOKEN_TTL_SECONDS}.`,
		);
	}

	return ttl;
}

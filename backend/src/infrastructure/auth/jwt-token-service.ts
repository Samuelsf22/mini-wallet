import { jwtVerify, SignJWT } from "jose";
import type { TokenIssuer } from "../../modules/users/application/ports/token-issuer.js";
import type { AuthenticatedUser } from "../../shared/application/authenticated-user.js";
import { Uuid } from "../../shared/domain/value-objects/uuid.js";
import type { AuthConfig } from "../config/auth.config.js";

const ACCESS_TOKEN_TYPE = "access";
const ACCESS_TOKEN_VERSION = 1;
const ALGORITHM = "HS256";

export interface JwtTokenServiceOptions {
	clock?: () => Date;
}

export interface VerifiedAccessToken {
	userId: Uuid;
}

export class JwtTokenService implements TokenIssuer {
	private readonly clock: () => Date;

	public constructor(
		private readonly config: AuthConfig,
		options: JwtTokenServiceOptions = {},
	) {
		this.clock = options.clock ?? (() => new Date());
	}

	public async issue(subject: AuthenticatedUser): Promise<string> {
		const issuedAt = Math.floor(this.clock().getTime() / 1_000);
		return new SignJWT({
			token_type: ACCESS_TOKEN_TYPE,
			token_version: ACCESS_TOKEN_VERSION,
		})
			.setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
			.setSubject(subject.userId.value)
			.setIssuer(this.config.issuer)
			.setAudience(this.config.audience)
			.setIssuedAt(issuedAt)
			.setExpirationTime(issuedAt + this.config.accessTokenTtlSeconds)
			.sign(this.config.jwtSecret);
	}

	public async verify(token: string): Promise<VerifiedAccessToken> {
		try {
			const { payload } = await jwtVerify(token, this.config.jwtSecret, {
				algorithms: [ALGORITHM],
				issuer: this.config.issuer,
				audience: this.config.audience,
				currentDate: this.clock(),
			});
			if (
				payload.token_type !== ACCESS_TOKEN_TYPE ||
				payload.token_version !== ACCESS_TOKEN_VERSION ||
				typeof payload.exp !== "number" ||
				typeof payload.sub !== "string"
			) {
				throw new Error("Invalid access token.");
			}
			return { userId: Uuid.of(payload.sub) };
		} catch {
			throw new Error("Invalid access token.");
		}
	}
}

import type { AuthenticatedUser } from "../../../../shared/application/authenticated-user.js";

export interface TokenIssuer {
	issue(subject: AuthenticatedUser): Promise<string>;
}

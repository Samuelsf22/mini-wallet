export interface PasswordHasher {
	hash(password: string): Promise<string>;
	/**
	 * Must perform comparable password-verification work whether passwordHash is
	 * present or missing. Implementations choose any internal fallback hash.
	 */
	verify(password: string, passwordHash: string | undefined): Promise<boolean>;
}

export interface DatabaseConfig {
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
}

export function readDatabaseConfig(
	environment: NodeJS.ProcessEnv,
): DatabaseConfig {
	return Object.freeze({
		host: requiredEnvironmentValue(environment, "DATABASE_HOST"),
		port: databasePort(environment.DATABASE_PORT),
		database: requiredEnvironmentValue(environment, "DATABASE_NAME"),
		username: requiredEnvironmentValue(environment, "DATABASE_USER"),
		password: requiredEnvironmentValue(environment, "DATABASE_PASSWORD"),
	});
}

function requiredEnvironmentValue(
	environment: NodeJS.ProcessEnv,
	name: string,
): string {
	const value = environment[name]?.trim();
	if (value === undefined || value === "") {
		throw new Error(`${name} must be a non-empty environment variable.`);
	}

	return value;
}

function databasePort(value: string | undefined): number {
	if (value === undefined || !/^\d+$/.test(value)) {
		throw new Error("DATABASE_PORT must be an integer between 1 and 65535.");
	}

	const port = Number(value);
	if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
		throw new Error("DATABASE_PORT must be an integer between 1 and 65535.");
	}

	return port;
}

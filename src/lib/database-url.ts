export function resolveDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return environment.NODE_ENV === "test"
    ? environment.TEST_DATABASE_URL
    : environment.DATABASE_URL;
}

export function requireDatabaseUrl(
  purpose: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const databaseUrl = resolveDatabaseUrl(environment);
  if (databaseUrl) return databaseUrl;

  const variable = environment.NODE_ENV === "test"
    ? "TEST_DATABASE_URL"
    : "DATABASE_URL";
  throw new Error(`${variable} is required ${purpose}.`);
}

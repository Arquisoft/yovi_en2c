function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const env = {
  port: Number(required("PORT", "4001")),
  gameyBaseUrl: required("GAMEY_BASE_URL", "http://localhost:4000"),
  gameyApiVersion: required("GAMEY_API_VERSION", "v1")
};
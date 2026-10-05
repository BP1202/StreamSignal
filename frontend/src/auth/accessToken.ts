export type AccessTokenGetter = () => Promise<string | undefined>;

let accessTokenGetter: AccessTokenGetter | null = null;

export function registerAccessTokenGetter(getter: AccessTokenGetter | null): void {
  accessTokenGetter = getter;
}

export async function getAccessToken(): Promise<string | null> {
  if (!accessTokenGetter) return null;
  const token = await accessTokenGetter();
  return token || null;
}

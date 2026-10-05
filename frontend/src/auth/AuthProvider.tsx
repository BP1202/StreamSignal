import React, { createContext, useContext, useEffect, useMemo } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { registerAccessTokenGetter } from "./accessToken";

export interface AppAuthState {
  isConfigured: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasResearcherRole: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const anonymousAuthState: AppAuthState = {
  isConfigured: false,
  isLoading: false,
  isAuthenticated: false,
  hasResearcherRole: false,
  signIn: async () => undefined,
  signOut: () => undefined,
};

const AppAuthContext = createContext<AppAuthState>(anonymousAuthState);

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;
const roleClaim = (import.meta.env.VITE_AUTH0_ROLE_CLAIM as string | undefined) || "https://streamsignal.app/roles";
const researcherRole = (import.meta.env.VITE_AUTH0_RESEARCHER_ROLE as string | undefined) || "RESEARCHER";
const isAuth0Configured = Boolean(auth0Domain && auth0ClientId && auth0Audience);

const Auth0Bridge: React.FC<React.PropsWithChildren> = ({ children }) => {
  const {
    getAccessTokenSilently,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();

  registerAccessTokenGetter(() =>
    getAccessTokenSilently({
      authorizationParams: { audience: auth0Audience },
    })
  );
  useEffect(() => () => registerAccessTokenGetter(null), []);

  const hasResearcherRole = useMemo(() => {
    const claimValue = (user as Record<string, unknown> | undefined)?.[roleClaim];
    const roles = typeof claimValue === "string" ? [claimValue] : claimValue;
    return Array.isArray(roles) && roles.includes(researcherRole);
  }, [user]);

  const value: AppAuthState = {
    isConfigured: true,
    isLoading,
    isAuthenticated,
    hasResearcherRole,
    signIn: async () => {
      await loginWithRedirect({
        appState: { returnTo: window.location.pathname + window.location.search },
      });
    },
    signOut: () => logout({ logoutParams: { returnTo: window.location.origin } }),
  };

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  if (!isAuth0Configured) {
    registerAccessTokenGetter(null);
    return <AppAuthContext.Provider value={anonymousAuthState}>{children}</AppAuthContext.Provider>;
  }

  return (
    <Auth0Provider
      domain={auth0Domain!}
      clientId={auth0ClientId!}
      useRefreshTokens
      cacheLocation="memory"
      authorizationParams={{
        audience: auth0Audience,
        redirect_uri: window.location.origin,
        scope: "openid profile email offline_access",
      }}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
};

export function useAppAuth(): AppAuthState {
  return useContext(AppAuthContext);
}

import Keycloak from 'keycloak-js';

const rawConfig = {
  PUBLIC_KEYCLOAK_URL: import.meta.env.PUBLIC_KEYCLOAK_URL,
  PUBLIC_KEYCLOAK_REALM: import.meta.env.PUBLIC_KEYCLOAK_REALM,
  PUBLIC_KEYCLOAK_CLIENT_ID: import.meta.env.PUBLIC_KEYCLOAK_CLIENT_ID,
  PUBLIC_OAUTH_REDIRECT_URI: import.meta.env.PUBLIC_OAUTH_REDIRECT_URI
} as const;

const missingConfigKeys = Object.entries(rawConfig)
  .filter(([, value]) => typeof value !== 'string' || value.length === 0)
  .map(([key]) => key);

const authConfigured = missingConfigKeys.length === 0;

let kc: Keycloak.KeycloakInstance | null = null;
let initPromise: Promise<Keycloak.KeycloakInstance> | null = null;

export function isAuthConfigured() {
  return authConfigured;
}

export function getMissingAuthConfig() {
  return [...missingConfigKeys];
}

function getKeycloak() {
  if (!authConfigured || typeof window === 'undefined') return null;
  if (!kc) {
    kc = new Keycloak({
      url: rawConfig.PUBLIC_KEYCLOAK_URL!,
      realm: rawConfig.PUBLIC_KEYCLOAK_REALM!,
      clientId: rawConfig.PUBLIC_KEYCLOAK_CLIENT_ID!
    });
  }
  return kc;
}

export function initAuth() {
  const keycloak = getKeycloak();
  if (!keycloak) return Promise.resolve(null);
  if (!initPromise) {
    initPromise = keycloak
      .init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        pkceMethod: 'S256',
        checkLoginIframe: false
      })
      .then(() => keycloak);
  }
  return initPromise;
}

export function login() {
  const keycloak = getKeycloak();
  if (!keycloak) return Promise.resolve();
  return keycloak.login({
    redirectUri: rawConfig.PUBLIC_OAUTH_REDIRECT_URI || window.location.origin
  });
}

export function logout() {
  console.log("HOLA")
  const keycloak = getKeycloak();
  if (!keycloak) return Promise.resolve();
  return keycloak.logout({ redirectUri: window.location.origin });
}

export function isAuthenticated() {
  const keycloak = getKeycloak();
  return keycloak?.authenticated === true;
}

export function getToken() {
  const keycloak = getKeycloak();
  return keycloak?.token ?? undefined;
}

export async function getFreshToken() {
  const keycloak = getKeycloak();
  if (!keycloak || !keycloak.authenticated) return undefined;
  await keycloak.updateToken(30).catch(() => keycloak.login());
  return keycloak.token ?? undefined;
}

export function hasRole(role: string) {
  const keycloak = getKeycloak();
  return keycloak ? keycloak.hasRealmRole(role) : false;
}

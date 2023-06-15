export type AuthenticationMethod = "authenticator" | "emailMagicLink" | "webAuthn";

export type AvailableAuthenticationMethods = Record<AuthenticationMethod, boolean>;

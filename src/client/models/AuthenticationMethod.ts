export type AuthenticationMethod = "authenticator" | "magicLinkEmail" | "webAuthn";

export type AvailableAuthenticationMethods = Record<AuthenticationMethod, boolean>;

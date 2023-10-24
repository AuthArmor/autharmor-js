export type AuthenticationMethod = "authenticator" | "magicLinkEmail" | "passkey";

export type AvailableAuthenticationMethods = Record<AuthenticationMethod, boolean>;

export type AuthArmorClientConfiguration = IAuthArmorClientSdkApiKeyConfiguration &
    IAuthArmorClientEnvironmentConfiguration &
    IAuthArmorWebAuthnConfiguration;

interface IAuthArmorClientSdkApiKeyConfiguration {
    clientSdkApiKey: string;
}

interface IAuthArmorClientEnvironmentConfiguration {
    environment: AuthArmorEnvironment;
}

type AuthArmorEnvironment = "production" | "development";

interface IAuthArmorWebAuthnConfiguration {
    webAuthnClientId?: string;
}

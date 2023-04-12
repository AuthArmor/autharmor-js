export type AuthArmorClientConfiguration = IAuthArmorClientSdkApiKeyConfiguration &
    IAuthArmorClientEnvironmentConfiguration;

interface IAuthArmorClientSdkApiKeyConfiguration {
    clientSdkApiKey: string;
}

interface IAuthArmorClientEnvironmentConfiguration {
    environment: AuthArmorEnvironment;
}

type AuthArmorEnvironment = "production" | "development";

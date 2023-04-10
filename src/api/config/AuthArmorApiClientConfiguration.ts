export type AuthArmorApiClientConfiguration = IAuthArmorClientSdkApiKeyConfiguration &
    AuthArmorApiClientEndpointConfiguration;

interface IAuthArmorClientSdkApiKeyConfiguration {
    clientSdkApiKey: string;
}

type AuthArmorApiClientEndpointConfiguration =
    | IAuthArmorApiClientEndpointConfigurationWithEnvironment
    | IAuthArmorApiClientEndpointConfigurationWithBaseUrl;

interface IAuthArmorApiClientEndpointConfigurationWithEnvironment {
    environment: AuthArmorApiEnvironment;
    baseUrl?: never;
}

interface IAuthArmorApiClientEndpointConfigurationWithBaseUrl {
    baseUrl: string;
    environment?: never;
}

type AuthArmorApiEnvironment = "production" | "development";

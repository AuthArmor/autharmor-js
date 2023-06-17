export type AuthArmorClientConfiguration = IAuthArmorClientSdkApiKeyConfiguration &
    IAuthArmorWebAuthnConfiguration;

interface IAuthArmorClientSdkApiKeyConfiguration {
    clientSdkApiKey: string;
}

interface IAuthArmorWebAuthnConfiguration {
    webAuthnClientId?: string;
}

export interface IAuthenticateOptions {
    timeoutSeconds: number;
}

export interface IAuthenticatorAuthenticateOptions extends IAuthenticateOptions {
    useVisualVerify: boolean;
    actionName: string;
    shortMessage: string;
}

export interface IAuthenticatorUsernamelessAuthenticateOptions
    extends IAuthenticatorAuthenticateOptions {}

export interface IAuthenticatorUserSpecificAuthenticateOptions
    extends IAuthenticatorAuthenticateOptions {
    sendPushNotification: boolean;
}

export interface IMagicLinkEmailAuthenticateOptions extends IAuthenticateOptions {
    actionName: string;
    shortMessage: string;
}

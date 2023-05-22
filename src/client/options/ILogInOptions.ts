export interface ILogInOptions {
    timeoutSeconds: number;
}

export interface IAuthenticatorLogInOptions extends ILogInOptions {
    useVisualVerify: boolean;
    actionName: string;
    shortMessage: string;
}

export interface IAuthenticatorUsernamelessLogInOptions extends IAuthenticatorLogInOptions {}

export interface IAuthenticatorUserSpecificLogInOptions extends IAuthenticatorLogInOptions {
    sendPushNotification: boolean;
}

export interface IEmailMagicLinkLogInOptions extends ILogInOptions {
    actionName: string;
    shortMessage: string;
}

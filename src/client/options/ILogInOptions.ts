export interface ILogInOptions {
    timeoutSeconds: number;
}

export interface IAuthenticatorLogInOptions extends ILogInOptions {
    useVisualVerify: boolean;
    actionName: string;
    shortMessage: string;
}

export interface IAuthenticatorNotificationLogInOptions extends IAuthenticatorLogInOptions {}

export interface IAuthenticatorQrCodeLogInOptions extends IAuthenticatorLogInOptions {}

export interface IEmailMagicLinkLogInOptions extends ILogInOptions {
    actionName: string;
    shortMessage: string;
}

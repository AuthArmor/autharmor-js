export interface IRegisterOptions {
    timeoutSeconds: number;
}

export interface IAuthenticatorRegisterOptions extends IRegisterOptions {
    actionName: string;
    shortMessage: string;
}

export interface IMagicLinkEmailRegisterOptions extends IRegisterOptions {
    actionName: string;
    shortMessage: string;
}

export interface IPasskeyRegisterOptions {
    attachmentType: "Any" | "Platform" | "CrossPlatform";
}

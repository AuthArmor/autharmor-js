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

export interface IWebAuthnRegisterOptions {
    attachmentType: "Any" | "Platform" | "CrossPlatform";
}

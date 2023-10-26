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
    attachmentType: "any" | "platform" | "crossPlatform";
    residentKeyRequirementType: "required" | "preferred" | "discouraged";
    userVerificationRequirementType: "required" | "preferred" | "discouraged";
}

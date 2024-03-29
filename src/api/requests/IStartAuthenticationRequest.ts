export interface IStartAuthenticationRequest {
    actionName: string;
    shortMessage: string;
    originLocation?: IOriginLocation;
    timeoutSeconds: number;
    nonce: string;
}

export interface IStartAuthenticatorAuthenticationRequest extends IStartAuthenticationRequest {
    useVisualVerify: boolean;
}

export interface IStartAuthenticatorUserSpecificAuthenticationRequest
    extends IStartAuthenticatorAuthenticationRequest {
    username: string;
    sendPushNotification: boolean;
}

export interface IStartAuthenticatorUsernamelessAuthenticationRequest
    extends IStartAuthenticatorAuthenticationRequest {}

export interface IStartWebAuthnAuthenticationRequest {
    username: string;
    attachmentType: WebAuthnAttachmentType;
    webAuthnClientId: string;
    nonce: string;
}

export interface IStartMagicLinkEmailAuthenticationRequest extends IStartAuthenticationRequest {
    username: string;
    redirectUrl: string;
    context: Record<string, string>;
}

export interface IStartRegistrationRequest extends IStartAuthenticationRequest {
    username: string;
}

export interface IStartAuthenticatorRegistrationRequest extends IStartRegistrationRequest {}

export interface IStartWebAuthnRegistrationRequest {
    username: string;
    attachmentType: WebAuthnAttachmentType;
    residentKeyRequirementType: WebAuthnResidentKeyRequirementType;
    userVerificationRequirementType: WebAuthnUserVerificationRequirementType;
    webAuthnClientId: string;
    nonce: string;
}

export interface IStartMagicLinkEmailRegistrationRequest extends IStartRegistrationRequest {
    redirectUrl: string;
    context: Record<string, string>;
}

interface IOriginLocation {
    latitude: string;
    longitude: string;
}

type WebAuthnAttachmentType = "Any" | "Platform" | "CrossPlatform";
type WebAuthnResidentKeyRequirementType = "required" | "preferred" | "discouraged";
type WebAuthnUserVerificationRequirementType = "required" | "preferred" | "discouraged";

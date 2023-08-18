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
}

export interface IStartRegistrationRequest extends IStartAuthenticationRequest {
    username: string;
}

export interface IStartAuthenticatorRegistrationRequest extends IStartRegistrationRequest {}

export interface IStartWebAuthnRegistrationRequest {
    username: string;
    attachmentType: WebAuthnAttachmentType;
    webAuthnClientId: string;
    nonce: string;
}

export interface IStartMagicLinkEmailRegistrationRequest extends IStartRegistrationRequest {
    redirectUrl: string;
}

interface IOriginLocation {
    latitude: string;
    longitude: string;
}

type WebAuthnAttachmentType = "Any" | "Platform" | "CrossPlatform";

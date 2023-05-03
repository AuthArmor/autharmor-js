export interface IStartAuthenticationRequest {
    reCaptchaToken?: string;
    originLocation?: IOriginLocation;
    timeoutSeconds: number;
    nonce: string;
}

export interface IStartAuthenticatorAuthenticationRequest extends IStartAuthenticationRequest {
    useVisualVerify: boolean;
}

export interface IStartAuthenticatorNotificationAuthenticationRequest
    extends IStartAuthenticatorAuthenticationRequest {
    username: string;
}

export interface IStartAuthenticatorQrCodeAuthenticationRequest
    extends IStartAuthenticatorAuthenticationRequest {}

export interface IStartWebAuthnAuthenticationRequest {
    username: string;
    attachmentType: WebAuthnAttachmentType;
    webAuthnClientId: string;
    nonce: string;
}

export interface IStartMagicLinkAuthenticationRequest extends IStartAuthenticationRequest {
    username: string;
    redirectUrl: string;
}

export interface IStartRegistrationRequest extends IStartAuthenticationRequest {
    username: string;
}

export interface IStartAuthenticatorRegistrationRequest extends IStartRegistrationRequest {}

export interface IStartWebAuthnRegistrationRequest extends IStartRegistrationRequest {
    attachmentType: WebAuthnAttachmentType;
    webAuthnClientId: string;
}

export interface IStartMagicLinkRegistrationRequest extends IStartRegistrationRequest {
    redirectUrl: string;
}

interface IOriginLocation {
    latitude: string;
    longitude: string;
}

type WebAuthnAttachmentType = "Any" | "Platform" | "CrossPlatform";

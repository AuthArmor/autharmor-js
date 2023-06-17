export interface ICompleteAuthenticationRequest {}

export interface ICompleteWebAuthnRequest extends ICompleteAuthenticationRequest {
    authArmorSignature: string;
    webAuthnClientId: string;
}

export interface ICompleteWebAuthnAuthenticationRequest extends ICompleteWebAuthnRequest {
    authenticatorResponseData: string;
    authRequestId: string;
}

export interface ICompleteWebAuthnRegistrationRequest extends ICompleteWebAuthnRequest {
    authenticatorResponseData: object;
    registrationId: string;
}

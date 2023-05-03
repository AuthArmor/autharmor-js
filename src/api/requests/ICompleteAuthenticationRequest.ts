export interface ICompleteAuthenticationRequest {}

export interface ICompleteWebAuthnRequest extends ICompleteAuthenticationRequest {
    authenticatorResponseData: string;
    authArmorSignature: string;
    webAuthnClientId: string;
}


export interface ICompleteWebAuthnAuthenticationRequest extends ICompleteWebAuthnRequest {
    authRequestId: string;
}

export interface ICompleteWebAuthnRegistrationRequest extends ICompleteWebAuthnRequest {
    registrationId: string;
}

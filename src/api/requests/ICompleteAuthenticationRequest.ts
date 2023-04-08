export interface ICompleteAuthenticationRequest {}

export interface ICompleteWebAuthnAuthenticationRequest extends ICompleteAuthenticationRequest {
    authenticatorResponseData: string;
    registrationId: string;
    authArmorSignature: string;
    webAuthnClientId: string;
}

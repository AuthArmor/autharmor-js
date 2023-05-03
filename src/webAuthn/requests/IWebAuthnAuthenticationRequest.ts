export interface IWebAuthnAuthenticationRequest {
    fido2_json_options: string;
}

export interface IWebAuthnLogInRequest extends IWebAuthnAuthenticationRequest {
    auth_request_id: string;
    aa_guid: string;
}

export interface IWebAuthnRegistrationRequest extends IWebAuthnAuthenticationRequest {
    registration_id: string;
    aa_sig: string;
}

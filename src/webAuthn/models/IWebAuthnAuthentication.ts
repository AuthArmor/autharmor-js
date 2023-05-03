export interface IWebAuthnAuthentication {
    authenticator_response_data: string;
    aa_sig: string;
    webauthn_client_id: string;
}

export interface IWebAuthnLogIn extends IWebAuthnAuthentication {
    auth_request_id: string;
}

export interface IWebAuthnRegistration extends IWebAuthnAuthentication {
    registration_id: string;
}

export interface IRegistrationSession {}

export interface IAuthenticatorRegistrationSession {
    authMethod: "AuthArmorAuthenticator";
    qr_code_data: string;
    date_expires: string;
    google_v3_recaptcha_token: string;
    registration_status: string | null;
    registration_type: string | null;
    user_id: string;
    username: string;
}

export interface IMagicLinkRegistrationSession extends IRegistrationSession {
    auth_request_id: string;
    google_v3_recaptcha_token: string | null;
}

export interface IWebAuthnRegistrationSession extends IRegistrationSession {
    fido2_json_options: string;
    registration_id: string;
    aa_sig: string;
}

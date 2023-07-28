export interface IRegistrationSession {
    registration_id: string
}

export interface IAuthenticatorRegistrationSession extends IRegistrationSession {
    registration_validation_token: string;
    qr_code_data: string;
    date_expires: string;
    google_v3_recaptcha_token: string;
    registration_status: string | null;
    registration_type: string | null;
    user_id: string;
    username: string;
}

export interface IMagicLinkRegistrationSession extends IRegistrationSession {
    google_v3_recaptcha_token: string | null;
}

export interface IWebAuthnRegistrationSession extends IRegistrationSession {
    fido2_json_options: string;
    aa_sig: string;
}

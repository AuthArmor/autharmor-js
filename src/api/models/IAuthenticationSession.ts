export interface IAuthenticationSession {
    auth_request_id: string;
    response_code: number;
    response_message: string | null;
    timeout_in_seconds: number;
    timeout_utc_datetime: string;
}

export interface IAuthenticatorAuthenticationSession extends IAuthenticationSession {
    auth_profile_id: string;
    auth_validation_token: string;
    push_message_sent: boolean;
    visual_verify_value: string;
    qr_code_data: string;
}

export interface IAuthenticatorUsernamelessAuthenticationSession
    extends IAuthenticatorAuthenticationSession {
    push_message_sent: false;
}

export interface IMagicLinkAuthenticationSession extends IAuthenticationSession {
    user_id: string;
}

export interface IWebAuthnAuthenticationSession extends IAuthenticationSession {
    aa_guid: string;
    fido2_json_options: string;
}

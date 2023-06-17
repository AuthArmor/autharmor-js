export interface IAuthenticationResult {
    user_id: string;
    username: string | null;
}

export interface IWebAuthnAuthenticationResult extends IAuthenticationResult {
    auth_validation_token: string;
    auth_request_id: string;
}

export interface IWebAuthnRegistrationResult extends IAuthenticationResult {}

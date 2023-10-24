export interface IPasskeyAuthentication {
    auth_request_id: string;
    authenticator_response_data: object;
    aa_sig: string;
    webauthn_client_id: string;
}

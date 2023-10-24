export interface IPasskeyRegistration {
    registration_id: string;
    authenticator_response_data: object;
    aa_sig: string;
    webauthn_client_id: string;
}

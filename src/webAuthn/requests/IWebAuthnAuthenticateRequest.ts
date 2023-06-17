export interface IWebAuthnAuthenticateRequest {
    fido2_json_options: string;
    auth_request_id: string;
    aa_guid: string;
}

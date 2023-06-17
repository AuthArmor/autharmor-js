export interface IWebAuthnRegisterRequest {
    fido2_json_options: string;
    registration_id: string;
    aa_sig: string;
}

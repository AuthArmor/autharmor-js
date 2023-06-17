import { BrowserBase64Coder } from "../infrastructure/BrowserBase64Coder";
import { IBase64Coder } from "../infrastructure/IBase64Coder";
import { WebAuthnRequestDeniedError } from "./errors";
import { IWebAuthnAuthentication, IWebAuthnRegistration } from "./models";
import { IWebAuthnAuthenticateRequest, IWebAuthnRegisterRequest } from "./requests";
import { IPublicKeyCredentialRequest } from "./requests/IPublicKeyCredentialRequest";

export class WebAuthnService {
    public constructor(
        private readonly webAuthnClientId: string,
        private readonly base64Coder: IBase64Coder = new BrowserBase64Coder()
    ) {}

    public async authenticateAsync(
        authenticateRequest: IWebAuthnAuthenticateRequest
    ): Promise<IWebAuthnAuthentication> {
        const jsonOptions = JSON.parse(
            authenticateRequest.fido2_json_options
        ) as IPublicKeyCredentialRequest;
        const publicKey = this.processPublicKeyCredentialRequest(jsonOptions);

        let attestation: PublicKeyCredential | null;

        try {
            attestation = (await navigator.credentials.get({
                publicKey
            })) as PublicKeyCredential | null;
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === "NotAllowedError") {
                attestation = null;
            } else {
                throw error;
            }
        }

        if (attestation === null) {
            throw new WebAuthnRequestDeniedError();
        }

        const result: IWebAuthnAuthentication = {
            authenticator_response_data: this.getAuthenticatorResponseData(attestation),
            auth_request_id: authenticateRequest.auth_request_id,
            aa_sig: authenticateRequest.aa_guid,
            webauthn_client_id: this.webAuthnClientId
        };

        return result;
    }

    public async registerAsync(
        registrationRequest: IWebAuthnRegisterRequest
    ): Promise<IWebAuthnRegistration> {
        const jsonOptions = JSON.parse(
            registrationRequest.fido2_json_options
        ) as IPublicKeyCredentialRequest;
        const publicKey = this.processPublicKeyCredentialRequest(jsonOptions);

        let attestation: PublicKeyCredential | null;

        try {
            attestation = (await navigator.credentials.create({
                publicKey
            })) as PublicKeyCredential | null;
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === "NotAllowedError") {
                attestation = null;
            } else {
                throw error;
            }
        }

        if (attestation === null) {
            throw new WebAuthnRequestDeniedError();
        }

        const result: IWebAuthnRegistration = {
            authenticator_response_data: this.getAuthenticatorResponseData(attestation),
            registration_id: registrationRequest.registration_id,
            aa_sig: registrationRequest.aa_sig,
            webauthn_client_id: this.webAuthnClientId
        };

        return result;
    }

    private getAuthenticatorResponseData(attestation: PublicKeyCredential): object {
        const attestationResponse = attestation.response as
            | AuthenticatorAssertionResponse
            | AuthenticatorAttestationResponse;

        const data = {
            id: attestation.id,
            rawId: this.getBase64FromArrayBuffer(attestation.rawId),
            attestation_object: this.getBase64FromArrayBuffer(
                "attestationObject" in attestationResponse
                    ? attestationResponse.attestationObject
                    : attestationResponse.authenticatorData
            ),
            authenticator_data:
                "authenticatorData" in attestationResponse
                    ? this.getBase64FromArrayBuffer(attestationResponse.authenticatorData)
                    : null,
            client_data: this.getBase64FromArrayBuffer(attestationResponse.clientDataJSON),
            user_handle:
                "userHandle" in attestationResponse && attestationResponse.userHandle !== null
                    ? this.getBase64FromArrayBuffer(attestationResponse.userHandle)
                    : null,
            extensions: attestation.getClientExtensionResults(),
            signature:
                "signature" in attestationResponse
                    ? this.getBase64FromArrayBuffer(attestationResponse.signature)
                    : null
        };

        return data;
    }

    private processPublicKeyCredentialRequest(
        publicKeyCredentialRequest: IPublicKeyCredentialRequest
    ): PublicKeyCredentialRequestOptions & PublicKeyCredentialCreationOptions {
        const processedRequest: PublicKeyCredentialRequestOptions &
            PublicKeyCredentialCreationOptions = {
            ...publicKeyCredentialRequest,
            allowCredentials: publicKeyCredentialRequest.allowCredentials?.map((credential) => ({
                ...credential,
                id: this.getUint8ArrayFromBase64(credential.id)
            })),
            excludeCredentials: publicKeyCredentialRequest.excludeCredentials?.map(
                (credential) => ({
                    ...credential,
                    id: this.getUint8ArrayFromBase64(credential.id)
                })
            ),
            user:
                typeof publicKeyCredentialRequest.user === "object"
                    ? {
                          ...publicKeyCredentialRequest.user,
                          id: this.getUint8ArrayFromBase64(publicKeyCredentialRequest.user.id)
                      }
                    : publicKeyCredentialRequest.user,
            challenge: this.getUint8ArrayFromBase64(publicKeyCredentialRequest.challenge)
        };

        return processedRequest;
    }

    private getUint8ArrayFromBase64(base64: string): Uint8Array {
        const normalizedBase64 = this.normalizeBase64(base64);
        const binaryString = this.base64Coder.decodeFromBase64(normalizedBase64);

        const array = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
            array[i] = binaryString.charCodeAt(i);
        }

        return array;
    }

    private getBase64FromArrayBuffer(buffer: ArrayBuffer): string {
        const array = new Uint8Array(buffer);

        let binaryString = "";

        for (const byte of array) {
            binaryString += String.fromCharCode(byte);
        }

        const base64 = this.base64Coder.encodeToBase64(binaryString);
        const denormalizedBase64 = this.denormalizeBase64(base64);

        return denormalizedBase64;
    }

    private normalizeBase64(base64: string): string {
        let encoded = base64.replace(/-/g, "+").replace(/_/g, "/");

        while (encoded.length % 4 !== 0) {
            encoded += "=";
        }

        return encoded;
    }

    private denormalizeBase64(base64: string): string {
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }
}

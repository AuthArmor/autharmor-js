export interface IPublicKeyCredentialRequest {
    allowCredentials?: ICredential[];
    excludeCredentials?: ICredential[];
    user: IUser;
    challenge: string;
    authenticatorSelection: {
        authenticatorAttachment: AuthenticatorAttachment;
        requireResidentKey: boolean;
        userVerification: UserVerificationRequirement;
    };
    extensions: Record<string, any>;
    pubKeyCredParams: ICredentialParams[];
    rp: {
        id: string;
        name: string;
        icon?: string;
    };
    status?: "ok";
    errorMessage?: string;
    timeout: number;
}

interface IUser {
    id: string;
    name: string;
    displayName: string;
}

interface ICredential {
    id: string;
    type: CredentialType;
}

type CredentialType = "public-key";

interface ICredentialParams {
    type: CredentialType;
    alg: number;
}

export interface IUserEnrollments {
    enrolled_auth_methods: IEnrolledAuthMethod[];
}

export interface IEnrolledAuthMethod {
    auth_method_id: AuthMethod;
}

export enum AuthMethod {
    Authenticator = 4,
    MagicLinkEmail = 20,
    WebAuthn = 30
}

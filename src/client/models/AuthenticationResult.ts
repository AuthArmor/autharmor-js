export type AuthenticationResult = IAuthenticationSuccessResult | IAuthenticationFailureResult;

export interface IAuthenticationResult {
    requestId: string;
    authenticationMethod: string;
    succeeded: boolean;
}

export interface IAuthenticationSuccessResult extends IAuthenticationResult {
    succeeded: true;
    validationToken: string;
}

export interface IAuthenticationFailureResult extends IAuthenticationResult {
    succeeded: false;
    failureReason: AuthenticationFailureReason;
}

export type AuthenticationFailureReason = "timedOut" | "declined" | "aborted" | "unknown";

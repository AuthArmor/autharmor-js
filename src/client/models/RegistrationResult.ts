export type RegistrationResult = IRegistrationSuccessResult | IRegistrationFailureResult;

export interface IRegistrationSuccessResult {
    succeeded: true;
    userId: string;
    username: string;
}

export interface IRegistrationFailureResult {
    succeeded: false;
    failureReason: RegistrationFailureReason;
}

export type RegistrationFailureReason = "timedOut" | "aborted" | "unknown";

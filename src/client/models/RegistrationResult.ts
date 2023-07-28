export type RegistrationResult = IRegistrationSuccessResult | IRegistrationFailureResult;

export interface IRegistrationResult {
    registrationId: string;
    succeeded: boolean;
}

export interface IRegistrationSuccessResult extends IRegistrationResult {
    succeeded: true;
    validationToken: string;
}

export interface IRegistrationFailureResult extends IRegistrationResult {
    succeeded: false;
    failureReason: RegistrationFailureReason;
}

export type RegistrationFailureReason = "timedOut"| "declined" | "aborted" | "unknown";

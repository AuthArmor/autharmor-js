import { AuthenticationMethod } from "./AuthenticationMethod";

export type RegistrationResult = IRegistrationSuccessResult | IRegistrationFailureResult;

export interface IRegistrationResult {
    registrationId: string;
    authenticationMethod: AuthenticationMethod;
    succeeded: boolean;
}

export interface IRegistrationSuccessResult extends IRegistrationResult {
    succeeded: true;
    username: string;
    validationToken: string;
}

export interface IRegistrationFailureResult extends IRegistrationResult {
    succeeded: false;
    failureReason: RegistrationFailureReason;
}

export type RegistrationFailureReason = "timedOut" | "declined" | "unknown";

import { AuthenticationMethod, AvailableAuthenticationMethods } from "./AuthenticationMethod";
import {
    AuthenticationFailureReason,
    AuthenticationResult,
    IAuthenticationFailureResult,
    IAuthenticationSuccessResult
} from "./AuthenticationResult";
import {
    IRegistrationFailureResult,
    IRegistrationSuccessResult,
    RegistrationFailureReason,
    RegistrationResult
} from "./RegistrationResult";
import { QrCodeResult } from "./QrCodeResult";

export type {
    AuthenticationMethod,
    AvailableAuthenticationMethods,
    AuthenticationResult,
    IAuthenticationSuccessResult,
    AuthenticationFailureReason,
    IAuthenticationFailureResult,
    RegistrationResult,
    IRegistrationSuccessResult,
    IRegistrationFailureResult,
    RegistrationFailureReason,
    QrCodeResult
};

import { IApiError } from "./IApiError";
import { IAuthArmorAuthenticatorEnrollmentStatus } from "./IAuthArmorAuthenticatorEnrollmentStatus";
import { AuthArmorSdkConfiguration } from "./AuthArmorSdkConfiguration";
import {
    AuthenticationRequestCode,
    AuthenticationRequestStatusId,
    IAuthenticationRequestStatus
} from "./IAuthenticationRequestStatus";
import {
    IAuthenticationResult,
    IWebAuthnAuthenticationResult,
    IWebAuthnRegistrationResult
} from "./IAuthenticationResult";
import {
    IAuthenticationSession,
    IAuthenticatorAuthenticationSession,
    IAuthenticatorQrCodeAuthenticationSession,
    IMagicLinkAuthenticationSession,
    IWebAuthnAuthenticationSession
} from "./IAuthenticationSession";
import {
    IRegistrationSession,
    IMagicLinkRegistrationSession,
    IWebAuthnRegistrationSession,
    IAuthenticatorRegistrationSession
} from "./IRegistrationSession";
import { AuthMethod, IEnrolledAuthMethod, IUserEnrollments } from "./IUserEnrollments";

export type {
    IApiError,
    IAuthArmorAuthenticatorEnrollmentStatus,
    AuthArmorSdkConfiguration,
    IAuthenticationRequestStatus,
    IAuthenticationResult,
    IWebAuthnAuthenticationResult,
    IWebAuthnRegistrationResult,
    IAuthenticationSession,
    IAuthenticatorAuthenticationSession,
    IAuthenticatorQrCodeAuthenticationSession,
    IMagicLinkAuthenticationSession,
    IWebAuthnAuthenticationSession,
    IRegistrationSession,
    IAuthenticatorRegistrationSession,
    IMagicLinkRegistrationSession,
    IWebAuthnRegistrationSession,
    IUserEnrollments,
    IEnrolledAuthMethod
};

export { AuthenticationRequestStatusId, AuthenticationRequestCode, AuthMethod };

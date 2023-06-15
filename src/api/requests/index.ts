import {
    ICompleteAuthenticationRequest,
    ICompleteWebAuthnAuthenticationRequest,
    ICompleteWebAuthnRegistrationRequest,
    ICompleteWebAuthnRequest
} from "./ICompleteAuthenticationRequest";
import { IGetAuthenticationSessionStatusRequest } from "./IGetAuthenticationSessionStatusRequest";
import { IGetAuthenticatorEnrollmentStatusRequest } from "./IGetAuthenticatorEnrollmentStatusRequest";
import { IGetSdkConfigurationRequest } from "./IGetSdkConfigurationRequest";
import { IGetUserEnrollmentsRequest } from "./IGetUserEnrollmentsRequest";
import {
    IStartAuthenticationRequest,
    IStartAuthenticatorAuthenticationRequest,
    IStartAuthenticatorUserSpecificAuthenticationRequest,
    IStartAuthenticatorUsernamelessAuthenticationRequest,
    IStartWebAuthnAuthenticationRequest,
    IStartMagicLinkAuthenticationRequest,
    IStartRegistrationRequest,
    IStartAuthenticatorRegistrationRequest,
    IStartWebAuthnRegistrationRequest,
    IStartMagicLinkEmailRegistrationRequest
} from "./IStartAuthenticationRequest";

export type {
    ICompleteAuthenticationRequest,
    ICompleteWebAuthnRequest,
    ICompleteWebAuthnAuthenticationRequest,
    ICompleteWebAuthnRegistrationRequest,
    IGetAuthenticationSessionStatusRequest,
    IGetAuthenticatorEnrollmentStatusRequest,
    IGetSdkConfigurationRequest,
    IGetUserEnrollmentsRequest,
    IStartAuthenticationRequest,
    IStartAuthenticatorAuthenticationRequest,
    IStartAuthenticatorUserSpecificAuthenticationRequest,
    IStartAuthenticatorUsernamelessAuthenticationRequest,
    IStartMagicLinkAuthenticationRequest,
    IStartWebAuthnAuthenticationRequest,
    IStartRegistrationRequest,
    IStartAuthenticatorRegistrationRequest,
    IStartMagicLinkEmailRegistrationRequest as IStartMagicLinkRegistrationRequest,
    IStartWebAuthnRegistrationRequest
};

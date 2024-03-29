import { environment } from "../environment";
import { AuthArmorApiRequestSigner } from "./AuthArmorApiRequestSigner";
import { IAuthArmorApiClientConfiguration } from "./config";
import { ApiError } from "./errors";
import {
    AuthArmorSdkConfiguration,
    IUserEnrollments,
    IAuthenticationRequestStatus,
    IWebAuthnRegistrationSession,
    IMagicLinkRegistrationSession,
    IAuthenticatorAuthenticationSession,
    IWebAuthnAuthenticationSession,
    IAuthenticatorRegistrationSession,
    IApiError,
    IMagicLinkAuthenticationSession,
    IWebAuthnAuthenticationResult,
    IWebAuthnRegistrationResult,
    IAuthenticatorUsernamelessAuthenticationSession,
    IRegistrationRequestStatus
} from "./models";
import {
    ICaptchaConfirmationRequest,
    ICompleteWebAuthnAuthenticationRequest,
    ICompleteWebAuthnRegistrationRequest,
    IGetAuthenticationSessionStatusRequest,
    IGetSdkConfigurationRequest,
    IGetUserEnrollmentsRequest,
    IStartAuthenticatorRegistrationRequest,
    IStartAuthenticatorUserSpecificAuthenticationRequest,
    IStartAuthenticatorUsernamelessAuthenticationRequest,
    IStartMagicLinkEmailAuthenticationRequest,
    IStartMagicLinkEmailRegistrationRequest,
    IStartWebAuthnAuthenticationRequest,
    IStartWebAuthnRegistrationRequest
} from "./requests";
import { IGetRegistrationSessionStatusRequest } from "./requests/IGetRegistrationSessionStatusRequest";

/**
 * A low-level client for the AuthArmor JS SDK API that exposes its endpoints.
 */
export class AuthArmorApiClient {
    private readonly clientSdkApiKey: string;
    private readonly apiBaseUrl: string;

    public constructor(
        configuration: IAuthArmorApiClientConfiguration,
        private readonly requestSigner = new AuthArmorApiRequestSigner(
            configuration.clientSdkApiKey
        )
    ) {
        this.clientSdkApiKey = configuration.clientSdkApiKey;
        this.apiBaseUrl = configuration.baseUrl ?? environment.defaultApiBaseUrl;
    }

    /**
     * Retrieves the configuration for the SDK.
     */
    public async getSdkConfigurationAsync({}: IGetSdkConfigurationRequest = {}): Promise<AuthArmorSdkConfiguration> {
        return await this.fetchAsync<AuthArmorSdkConfiguration>("/api/v4/config/sdkinit");
    }

    /**
     * Retrieves the authentication methods the user is enrolled for.
     *
     * @returns The user's enrolled authentication methods.
     */
    public async getUserEnrollmentsAsync({
        username
    }: IGetUserEnrollmentsRequest): Promise<IUserEnrollments> {
        const userId = "00000000-0000-0000-0000-000000000000";

        return await this.fetchAsync<IUserEnrollments>(
            `/api/v4/users/${userId}/enrolledmethods`,
            "post",
            {
                username_or_email_address: username
            }
        );
    }

    /**
     * Gets the status of an authentication session.
     *
     * @returns The status of the authentication session.
     *
     * @remarks This endpoint should be polled when the user authenticates with a method that requires polling.
     */
    public async getAuthenticationSessionStatusAsync({
        sessionId
    }: IGetAuthenticationSessionStatusRequest): Promise<IAuthenticationRequestStatus> {
        return await this.fetchAsync<IAuthenticationRequestStatus>(
            `/api/v4/auth/request/status/${sessionId}`
        );
    }

    /**
     * Gets the status of a registration session.
     *
     * @returns The status of the registration session.
     *
     * @remarks This endpoint should be polled when the user registers with a method that requires polling.
     */
    public async getRegistrationSessionStatusAsync({
        registrationId
    }: IGetRegistrationSessionStatusRequest): Promise<IRegistrationRequestStatus> {
        return await this.fetchAsync<IRegistrationRequestStatus>(
            `/api/v4/users/registration/${registrationId}`
        );
    }

    /**
     * Starts an authentication session for a specific user using the AuthArmor Authenticator.
     *
     * @returns The authentication session.
     *
     * @remarks
     * Poll the status of the session using the `getAuthenticationSessionStatus` method. The
     * ReCaptcha action is `auth`.
     */
    public async startAuthenticatorUserSpecificAuthenticationAsync(
        {
            username,
            sendPushNotification,
            useVisualVerify,
            actionName,
            shortMessage,
            originLocation,
            timeoutSeconds,
            nonce
        }: IStartAuthenticatorUserSpecificAuthenticationRequest,
        captchaConfirmation?: ICaptchaConfirmationRequest
    ): Promise<IAuthenticatorAuthenticationSession> {
        return await this.fetchAsync<IAuthenticatorAuthenticationSession>(
            "/api/v4/auth/request/authenticator/start",
            "post",
            {
                username,
                send_push: sendPushNotification,
                use_visual_verify: useVisualVerify,
                origin_location_data: originLocation,
                action_name: actionName,
                short_msg: shortMessage,
                timeout_in_seconds: timeoutSeconds,
                hCaptcha_token: captchaConfirmation?.hCaptchaResponse,
                nonce
            }
        );
    }

    /**
     * Starts a usernameless authentication session using the AuthArmor Authenticator with a QR code to be scanned.
     *
     * @returns The authentication session.
     *
     * @remarks Poll the status of the session using the `getAuthenticationSessionStatus` method.
     */
    public async startAuthenticatorUsernamelessAuthenticationAsync({
        useVisualVerify,
        actionName,
        shortMessage,
        originLocation,
        timeoutSeconds,
        nonce
    }: IStartAuthenticatorUsernamelessAuthenticationRequest): Promise<IAuthenticatorUsernamelessAuthenticationSession> {
        return await this.fetchAsync<IAuthenticatorUsernamelessAuthenticationSession>(
            "/api/v4/auth/request/authenticator/start",
            "post",
            {
                send_push: false,
                use_visual_verify: useVisualVerify,
                origin_location_data: originLocation,
                action_name: actionName,
                short_msg: shortMessage,
                timeout_in_seconds: timeoutSeconds,
                nonce
            }
        );
    }

    /**
     * Starts a WebAuthn authentication session.
     *
     * @returns The authentication session.
     *
     * @remarks
     * After performing WebAuthn authentication on the session, call the
     * `completeWebAuthnAuthentication` method with the result.
     */
    public async startWebAuthnAuthenticationAsync({
        username,
        attachmentType,
        webAuthnClientId,
        nonce
    }: IStartWebAuthnAuthenticationRequest): Promise<IWebAuthnAuthenticationSession> {
        return await this.fetchAsync<IWebAuthnAuthenticationSession>(
            "/api/v4/auth/request/webauthn/start",
            "post",
            {
                username,
                attachment_type: attachmentType,
                webauthn_client_id: webAuthnClientId,
                nonce
            }
        );
    }

    /**
     * Completes a WebAuthn authentication session.
     *
     * @returns The authentication result.
     */
    public async completeWebAuthnAuthenticationAsync({
        authenticatorResponseData,
        authRequestId,
        authArmorSignature,
        webAuthnClientId
    }: ICompleteWebAuthnAuthenticationRequest): Promise<IWebAuthnAuthenticationResult> {
        return await this.fetchAsync<IWebAuthnAuthenticationResult>(
            "/api/v4/auth/request/webauthn/finish",
            "post",
            {
                authenticator_response_data: authenticatorResponseData,
                auth_request_id: authRequestId,
                aa_sig: authArmorSignature,
                webauthn_client_id: webAuthnClientId
            }
        );
    }

    /**
     * Sends a magic link to the user's email address to log in.
     *
     * @remarks
     * The user will be redirected to the URL specified in the `redirectUrl` parameter, which
     * must be registered via the AuthArmor dashboard. The resulting session will be authenticated.
     */
    public async sendMagicLinkEmailForAuthenticationAsync(
        {
            username,
            redirectUrl,
            context,
            actionName,
            shortMessage,
            originLocation,
            timeoutSeconds,
            nonce
        }: IStartMagicLinkEmailAuthenticationRequest,
        captchaConfirmation?: ICaptchaConfirmationRequest
    ): Promise<IMagicLinkAuthenticationSession> {
        return await this.fetchAsync<IMagicLinkAuthenticationSession>(
            "/api/v4/auth/request/magiclink/start",
            "post",
            {
                username,
                authentication_redirect_url: redirectUrl,
                context_data: context,
                origin_location_data: originLocation,
                action_name: actionName,
                short_msg: shortMessage,
                timeout_in_seconds: timeoutSeconds,
                hCaptcha_token: captchaConfirmation?.hCaptchaResponse,
                nonce
            }
        );
    }

    /**
     * Starts a registration session using the AuthArmor Authenticator.
     *
     * @returns The authentication session.
     */
    public async startAuthenticatorRegistrationAsync({
        username,
        actionName,
        shortMessage,
        originLocation,
        timeoutSeconds,
        nonce
    }: IStartAuthenticatorRegistrationRequest): Promise<IAuthenticatorRegistrationSession> {
        return await this.fetchAsync<IAuthenticatorRegistrationSession>(
            "/api/v4/users/register/authenticator/start",
            "post",
            {
                username,
                origin_location_data: originLocation,
                action_name: actionName,
                short_msg: shortMessage,
                timeout_in_seconds: timeoutSeconds,
                nonce
            }
        );
    }

    /**
     * Starts a registration session using WebAuthn.
     *
     * @returns The WebAuthn registration session.
     *
     * @remarks
     * After performing WebAuthn authentication on the session, call the
     * `completeWebAuthnRegistration` method with the result.
     */
    public async startWebAuthnRegistrationAsync({
        username,
        attachmentType,
        residentKeyRequirementType,
        userVerificationRequirementType,
        webAuthnClientId,
        nonce
    }: IStartWebAuthnRegistrationRequest): Promise<IWebAuthnRegistrationSession> {
        return await this.fetchAsync<IWebAuthnRegistrationSession>(
            "/api/v4/users/register/webauthn/start",
            "post",
            {
                username,
                attachment_type: attachmentType,
                resident_key_requirement_type: residentKeyRequirementType,
                userVerificationRequirementType: userVerificationRequirementType,
                webauthn_client_id: webAuthnClientId,
                nonce
            }
        );
    }

    /**
     * Completes a WebAuthn registration session.
     *
     * @returns The registration result.
     */
    public async completeWebAuthnRegistrationAsync({
        authenticatorResponseData,
        registrationId,
        authArmorSignature,
        webAuthnClientId
    }: ICompleteWebAuthnRegistrationRequest): Promise<IWebAuthnRegistrationResult> {
        return await this.fetchAsync<IWebAuthnRegistrationResult>(
            "/api/v4/users/register/webauthn/finish",
            "post",
            {
                authenticator_response_data: authenticatorResponseData,
                registration_id: registrationId,
                aa_sig: authArmorSignature,
                webauthn_client_id: webAuthnClientId
            }
        );
    }

    /**
     * Sends a magic link to the user's email address to register.
     *
     * @returns The registration session.
     *
     * @remarks
     * The user will be redirected to the URL specified in the `redirectUrl` parameter, which
     * must be registered via the AuthArmor dashboard. The resulting session will be authenticated.
     */
    public async sendMagicLinkEmailForRegistrationAsync(
        {
            username,
            redirectUrl,
            context,
            actionName,
            shortMessage,
            originLocation,
            timeoutSeconds,
            nonce
        }: IStartMagicLinkEmailRegistrationRequest,
        captchaConfirmation?: ICaptchaConfirmationRequest
    ): Promise<IMagicLinkRegistrationSession> {
        return this.fetchAsync<IMagicLinkRegistrationSession>(
            "/api/v4/users/register/magiclink/start",
            "post",
            {
                email_address: username,
                registration_redirect_url: redirectUrl,
                context_data: context,
                action_name: actionName,
                short_msg: shortMessage,
                origin_location_data: originLocation,
                timeout_in_seconds: timeoutSeconds,
                hCaptcha_token: captchaConfirmation?.hCaptchaResponse,
                nonce
            }
        );
    }

    /**
     * Fetches a resource from the AuthArmor API.
     *
     * @param relativeUrl The relative URL to fetch.
     * @param method The HTTP method to use.
     * @param payload The payload to send with the request.
     *
     * @returns The response body.
     */
    private async fetchAsync<TResponse, TPayload extends {} = {}>(
        relativeUrl: string,
        method: "get" | "post" = "get",
        payload?: TPayload,
        headers?: Record<string, string>
    ): Promise<TResponse> {
        const url = new URL(`${this.apiBaseUrl}${relativeUrl}`);
        url.searchParams.append("apikey", this.clientSdkApiKey);

        const finalUrl = url.toString();

        const encodedPayload = payload !== undefined ? JSON.stringify(payload ?? {}) : null;

        const signature = await this.requestSigner.signRequest(finalUrl, encodedPayload ?? "");

        const finalHeaders: HeadersInit = {
            ...headers,
            "X-AuthArmor-ClientMsgSigv1": signature
        };

        if (encodedPayload !== null) {
            finalHeaders["Content-Type"] = "application/json";
        }

        const options: RequestInit = {
            method,
            headers: finalHeaders,
            body: encodedPayload
        };

        const response = await fetch(finalUrl, options);

        if (!response.ok) {
            const errorBody = (await response.json()) as IApiError;

            throw new ApiError(errorBody);
        }

        const responseBody = (await response.json()) as TResponse;

        return responseBody;
    }
}

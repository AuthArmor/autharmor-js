import { AuthArmorApiRequestSigner } from "./AuthArmorApiRequestSigner";
import { ApiError } from "./errors/ApiError";
import {
    IAuthArmorSdkConfiguration,
    IUserEnrollments,
    IAuthArmorAuthenticatorEnrollmentStatus,
    IAuthenticationRequestStatus,
    IWebAuthnRegistrationSession,
    IMagicLinkRegistrationSession,
    IAuthenticatorQrCodeAuthenticationSession,
    IAuthenticatorAuthenticationSession,
    IWebAuthnAuthenticationSession,
    IAuthenticatorRegistrationSession,
    IApiError
} from "./models";
import {
    IWebAuthnAuthenticationResult,
    IWebAuthnRegistrationResult
} from "./models/IAuthenticationResult";
import {
    ICompleteWebAuthnAuthenticationRequest,
    IGetAuthenticationSessionStatusRequest,
    IGetAuthenticatorEnrollmentStatusRequest,
    IGetSdkConfigurationRequest,
    IGetUserEnrollmentsRequest,
    IStartAuthenticatorNotificationAuthenticationRequest,
    IStartAuthenticatorQrCodeAuthenticationRequest,
    IStartAuthenticatorRegistrationRequest,
    IStartMagicLinkAuthenticationRequest,
    IStartMagicLinkRegistrationRequest,
    IStartWebAuthnAuthenticationRequest,
    IStartWebAuthnRegistrationRequest
} from "./requests";

/**
 * A low-level client for the AuthArmor JS SDK API that exposes its endpoints.
 */
export class AuthArmorApiClient {
    private readonly apiBaseUrl = "https://auth.autharmor.dev";

    public constructor(
        private readonly clientSdkApiKey: string,
        private readonly requestSigner = new AuthArmorApiRequestSigner(clientSdkApiKey)
    ) {}

    /**
     * Retrieves the configuration for the SDK.
     */
    public async getSdkConfigurationAsync({}: IGetSdkConfigurationRequest = {}): Promise<IAuthArmorSdkConfiguration> {
        return await this.fetchAsync<IAuthArmorSdkConfiguration>("/api/v3/config/sdkinit");
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
            `/api/v3/users/${userId}/enrolledmethods`,
            "post",
            {
                username_or_email_address: username
            }
        );
    }

    /**
     * Checks whether the user is enrolled for the AuthArmor Authenticator.
     *
     * @returns The user's enrollment status for the AuthArmor Authenticator.
     *
     * @remarks This endpoint should be polled when the user registers with the authenticator.
     */
    public async getAuthenticatorEnrollmentStatusAsync({
        userId
    }: IGetAuthenticatorEnrollmentStatusRequest): Promise<IAuthArmorAuthenticatorEnrollmentStatus> {
        return await this.fetchAsync<IAuthArmorAuthenticatorEnrollmentStatus>(
            `/api/v3/users/${userId}/autharmorauthenticatorenrollmentstatus`
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
            `/api/v3/auth/request/status/${sessionId}`
        );
    }

    /**
     * Starts an authentication session using the AuthArmor Authenticator sending a push notification.
     *
     * @returns The authentication session.
     *
     * @remarks Poll the status of the session using the `getAuthenticationSessionStatus` method.
     */
    public async startAuthenticatorNotificationAuthenticationAsync({
        username,
        useVisualVerify,
        originLocation,
        timeoutSeconds,
        recaptchaToken,
        nonce
    }: IStartAuthenticatorNotificationAuthenticationRequest): Promise<IAuthenticatorAuthenticationSession> {
        return await this.fetchAsync<IAuthenticatorAuthenticationSession>(
            "/api/v3/auth/request/authenticator/start",
            "post",
            {
                username,
                send_push: true,
                use_visual_verify: useVisualVerify,
                origin_location_data: originLocation,
                timeout_in_seconds: timeoutSeconds,
                google_v3_recaptcha_token: recaptchaToken ?? "",
                nonce
            }
        );
    }

    /**
     * Starts an authentication session using the AuthArmor Authenticator with a QR code to be scanned.
     *
     * @returns The authentication session.
     *
     * @remarks Poll the status of the session using the `getAuthenticationSessionStatus` method.
     */
    public async startAuthenticatorQrCodeAuthenticationAsync({
        useVisualVerify,
        originLocation,
        timeoutSeconds,
        recaptchaToken,
        nonce
    }: IStartAuthenticatorQrCodeAuthenticationRequest): Promise<IAuthenticatorQrCodeAuthenticationSession> {
        return await this.fetchAsync<IAuthenticatorQrCodeAuthenticationSession>(
            "/api/v3/auth/request/authenticator/start",
            "post",
            {
                send_push: false,
                use_visual_verify: useVisualVerify,
                origin_location_data: originLocation,
                timeout_in_seconds: timeoutSeconds,
                google_v3_recaptcha_token: recaptchaToken ?? "",
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
        attachmentType,
        originLocation,
        timeoutSeconds,
        recaptchaToken,
        nonce
    }: IStartWebAuthnAuthenticationRequest): Promise<IWebAuthnAuthenticationSession> {
        return await this.fetchAsync<IWebAuthnAuthenticationSession>(
            "/api/v3/auth/request/webauthn/start",
            "post",
            {
                attachment_type: attachmentType,
                origin_location_data: originLocation,
                timeout_in_seconds: timeoutSeconds,
                google_v3_recaptcha_token: recaptchaToken ?? "",
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
        registrationId,
        authArmorSignature,
        webAuthnClientId
    }: ICompleteWebAuthnAuthenticationRequest): Promise<IWebAuthnAuthenticationResult> {
        return await this.fetchAsync<IWebAuthnAuthenticationResult>(
            "/api/v3/auth/request/webauthn/finish",
            "post",
            {
                authenticator_response_data: authenticatorResponseData,
                registration_id: registrationId,
                autharmor_signature: authArmorSignature,
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
    public async sendMagicLinkForAuthenticationAsync({
        username,
        redirectUrl,
        originLocation,
        timeoutSeconds,
        recaptchaToken,
        nonce
    }: IStartMagicLinkAuthenticationRequest): Promise<void> {
        return await this.fetchAsync<void>("/api/v3/auth/request/magicLink/start", "post", {
            username,
            authentication_redirect_url: redirectUrl,
            origin_location_data: originLocation,
            timeout_in_seconds: timeoutSeconds,
            google_v3_recaptcha_token: recaptchaToken ?? "",
            nonce
        });
    }

    /**
     * Starts a registration session using the AuthArmor Authenticator.
     *
     * @returns The authentication session.
     */
    public async startAuthenticatorRegistrationAsync({
        username,
        originLocation,
        timeoutSeconds,
        nonce
    }: IStartAuthenticatorRegistrationRequest): Promise<IAuthenticatorRegistrationSession> {
        return await this.fetchAsync<IAuthenticatorRegistrationSession>(
            "/api/v3/users/register/authenticator/start",
            "post",
            {
                username,
                origin_location_data: originLocation,
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
        webAuthnClientId,
        originLocation,
        timeoutSeconds,
        nonce
    }: IStartWebAuthnRegistrationRequest): Promise<IWebAuthnRegistrationSession> {
        return await this.fetchAsync<IWebAuthnRegistrationSession>(
            "/api/v3/users/register/webauthn/start",
            "post",
            {
                username,
                attachment_type: attachmentType,
                webauthn_client_id: webAuthnClientId,
                origin_location_data: originLocation,
                timeout_in_seconds: timeoutSeconds,
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
    }: ICompleteWebAuthnAuthenticationRequest): Promise<IWebAuthnRegistrationResult> {
        return await this.fetchAsync<IWebAuthnRegistrationResult>(
            "/api/v3/users/register/webauthn/finish",
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
    public async sendMagicLinkForRegistrationAsync({
        username,
        redirectUrl,
        originLocation,
        timeoutSeconds,
        nonce
    }: IStartMagicLinkRegistrationRequest): Promise<IMagicLinkRegistrationSession> {
        return this.fetchAsync<IMagicLinkRegistrationSession>(
            "/api/v3/users/register/magiclink/start",
            "post",
            {
                email_address: username,
                registration_redirect_url: redirectUrl,
                origin_location_data: originLocation,
                timeout_in_seconds: timeoutSeconds,
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
        payload?: TPayload
    ): Promise<TResponse> {
        const url = new URL(`${this.apiBaseUrl}${relativeUrl}`);
        url.searchParams.append("apikey", this.clientSdkApiKey);

        const finalUrl = url.toString();

        const encodedPayload = JSON.stringify(payload ?? {});

        const signature = await this.requestSigner.signRequest(finalUrl, encodedPayload);

        const options: RequestInit = {
            method,
            headers: {
                "X-AuthArmor-ClientMsgSigv1": signature
            },
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

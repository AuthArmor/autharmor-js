import { AuthArmorApiClient } from "../api/AuthArmorApiClient";
import * as ApiModels from "../api/models";
import { ICaptchaConfirmationRequest, IStartWebAuthnRegistrationRequest } from "../api/requests";
import { BrowserNonceGenerator } from "../infrastructure/BrowserNonceGenerator";
import { INonceGenerator } from "../infrastructure/INonceGenerator";
import { ISystemClock } from "../infrastructure/ISystemClock";
import { NativeSystemClock } from "../infrastructure/NativeSystemClock";
import {
    AuthenticationFailureReason,
    AuthenticationMethod,
    AuthenticationResult,
    AvailableAuthenticationMethods,
    IAuthenticationFailureResult,
    IAuthenticationSuccessResult,
    IRegistrationFailureResult,
    IRegistrationSuccessResult,
    QrCodeResult,
    RegistrationResult
} from "./models";
import { AuthArmorClientConfiguration } from "./config";
import { WebAuthnService } from "../webAuthn/WebAuthnService";
import { IPasskeyAuthentication, IPasskeyRegistration } from "../webAuthn/models";
import {
    IAuthenticatorRegisterOptions,
    IAuthenticatorUserSpecificAuthenticateOptions,
    IAuthenticatorUsernamelessAuthenticateOptions,
    IMagicLinkEmailAuthenticateOptions,
    IMagicLinkEmailRegisterOptions,
    IPasskeyRegisterOptions
} from "./options";
import { WebAuthnRequestDeniedError } from "../webAuthn";

/**
 * The client for programatically interacting with AuthArmor's client-side SDK.
 */
export class AuthArmorClient {
    /**
     * The promise returned by `initializeInternal`.
     */
    private initializationPromise: Promise<void> | null = null;

    /**
     * The ReCaptcha site ID.
     */
    private hCaptchaSiteId: string | null = null;

    /**
     * The WebAuthn client ID.
     */
    private readonly webAuthnClientId: string | null;

    /**
     * @param configuration The configuration for the client.
     * @param apiClient The API client for making requests to the AuthArmor API.
     * @param nonceGenerator The nonce generator.
     * @param systemClock The system clock.
     */
    public constructor(
        configuration: AuthArmorClientConfiguration,
        private readonly apiClient = new AuthArmorApiClient({
            clientSdkApiKey: configuration.clientSdkApiKey
        }),
        private readonly webAuthnService = configuration.webAuthnClientId !== undefined
            ? new WebAuthnService(configuration.webAuthnClientId)
            : null!,
        private readonly nonceGenerator: INonceGenerator = new BrowserNonceGenerator(),
        private readonly systemClock: ISystemClock = new NativeSystemClock()
    ) {
        this.webAuthnClientId = configuration.webAuthnClientId ?? null;
    }

    /**
     * Ensures that the client has been initialized for making requests.
     *
     * @returns A promise that resolves when the client has been initialized.
     *
     * @remarks
     * This method is called automatically by the client when needed, but may be called manually by
     * the user to control when the initialization occurs.
     */
    public async ensureInitialized(): Promise<void> {
        if (this.initializationPromise === null) {
            this.initializationPromise = this.initializeInternal();
        }

        await this.initializationPromise;
    }

    /**
     * Retrieves the hCaptcha site ID.
     *
     * @returns A promise that resolves with the hCaptcha site ID, or null if hCaptcha is disabled.
     *
     * @remarks This method only issues a network request if the client is not initialized.
     */
    public async getHCaptchaSiteId(): Promise<string | null> {
        await this.ensureInitialized();

        return this.hCaptchaSiteId;
    }

    /**
     * Gets the available authentication methods for a user.
     *
     * @param username The username of the user.
     *
     * @returns A promise that resolves with the available authentication methods.
     */
    public async getAvailableAuthenticationMethodsAsync(
        username: string
    ): Promise<AvailableAuthenticationMethods> {
        await this.ensureInitialized();

        const userEnrollments = await this.apiClient.getUserEnrollmentsAsync({ username });

        const authMethods = userEnrollments.enrolled_auth_methods.map((m) => m.auth_method_id);

        const result: AvailableAuthenticationMethods = {
            authenticator: authMethods.includes(ApiModels.AuthMethod.Authenticator),
            magicLinkEmail: authMethods.includes(ApiModels.AuthMethod.MagicLinkEmail),
            passkey: authMethods.includes(ApiModels.AuthMethod.Passkey)
        };

        return result;
    }

    /**
     * Authenticates a user using their authenticator app.
     *
     * @param username The username of the user to log in.
     * @param options The options to use for this request.
     * @param captchaConfirmationRequest The CAPTCHA confirmation.
     * @param abortSignal The abort signal to use for this request.
     *
     * @returns A promise that resolves with a QR code result for the authentication result.
     */
    public async authenticateWithAuthenticatorAsync(
        username: string,
        {
            sendPushNotification = true,
            useVisualVerify = false,
            actionName = "Log in",
            shortMessage = "Log in pending, please authorize",
            timeoutSeconds = 60
        }: Partial<IAuthenticatorUserSpecificAuthenticateOptions> = {},
        captchaConfirmationRequest?: ICaptchaConfirmationRequest,
        abortSignal?: AbortSignal
    ): Promise<QrCodeResult<AuthenticationResult>> {
        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const authSession = await this.apiClient.startAuthenticatorUserSpecificAuthenticationAsync(
            {
                username,
                sendPushNotification,
                useVisualVerify,
                actionName,
                shortMessage,
                timeoutSeconds,
                nonce
            },
            captchaConfirmationRequest
        );

        const result: QrCodeResult<AuthenticationResult> = {
            qrCodeUrl: authSession.qr_code_data,
            verificationCode: authSession.visual_verify_value || null,
            resultAsync: async () =>
                await this.pollForAuthenticationResultAsync(
                    "authenticator",
                    authSession.auth_request_id,
                    authSession.auth_validation_token,
                    timeoutSeconds,
                    abortSignal
                )
        };

        return result;
    }

    /**
     * Authenticates a user using an authenticator QR code that is not user-specific.
     *
     * @param options The options to use for this request.
     * @param abortSignal The abort signal to use for this request.
     *
     * @returns A promise that resolves with a QR code result for the authentication result.
     */
    public async authenticateWithAuthenticatorUsernamelessAsync(
        {
            useVisualVerify = false,
            actionName = "Log in",
            shortMessage = "Log in pending, please authorize",
            timeoutSeconds = 60
        }: Partial<IAuthenticatorUsernamelessAuthenticateOptions> = {},
        abortSignal?: AbortSignal
    ): Promise<QrCodeResult<AuthenticationResult>> {
        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const authSession = await this.apiClient.startAuthenticatorUsernamelessAuthenticationAsync({
            useVisualVerify,
            actionName,
            shortMessage,
            timeoutSeconds,
            nonce
        });

        const result: QrCodeResult<AuthenticationResult> = {
            qrCodeUrl: authSession.qr_code_data,
            verificationCode: authSession.visual_verify_value || null,
            resultAsync: async () =>
                await this.pollForAuthenticationResultAsync(
                    "authenticator",
                    authSession.auth_request_id,
                    authSession.auth_validation_token,
                    timeoutSeconds,
                    abortSignal
                )
        };

        return result;
    }

    /**
     * Sends an authentication magic link to the user's email address.
     *
     * @param emailAddress The email address of the user.
     * @param redirectUrl The URL to redirect to after the user has logged in.
     * @param captchaConfirmationRequest The CAPTCHA confirmation.
     * @param options The options to use for this request.
     *
     * @returns A promise that resolves with the registration result.
     *
     * @remarks
     * The user will be redirected to the specified URL after they have logged in. The validation
     * token and request ID will be added as query parameters with the names
     * `auth_validation_token` and `auth_request_id` respectively.
     *
     * The validation token will not be included in the returned `AuthenticationResult`.
     */
    public async sendAuthenticateMagicLinkEmailAsync(
        emailAddress: string,
        redirectUrl: string,
        {
            context = {},
            actionName = "Log in",
            shortMessage = "Log in pending, please authorize",
            timeoutSeconds = 300
        }: Partial<IMagicLinkEmailAuthenticateOptions> = {},
        captchaConfirmationRequest?: ICaptchaConfirmationRequest,
        abortSignal?: AbortSignal
    ): Promise<AuthenticationResult> {
        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const authSession = await this.apiClient.sendMagicLinkEmailForAuthenticationAsync(
            {
                username: emailAddress,
                redirectUrl,
                context,
                actionName,
                shortMessage,
                timeoutSeconds,
                nonce
            },
            captchaConfirmationRequest
        );

        const result: AuthenticationResult = await this.pollForAuthenticationResultAsync(
            "magicLinkEmail",
            authSession.auth_request_id,
            "",
            timeoutSeconds,
            abortSignal
        );

        return result;
    }

    /**
     * Authenticates a user using a passkey.
     *
     * @param username The username of the user.
     *
     * @returns A promise that resolves with the authentication result.
     */
    public async authenticateWithPasskeyAsync(username: string): Promise<AuthenticationResult> {
        if (this.webAuthnClientId === null) {
            throw new Error(
                "This AuthArmorClient was not instantiated with passkey support because a WebAuthn client ID was not provided."
            );
        }

        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const authSession = await this.apiClient.startWebAuthnAuthenticationAsync({
            username,
            webAuthnClientId: this.webAuthnClientId,
            attachmentType: "Any",
            nonce
        });

        let authentication: IPasskeyAuthentication;

        try {
            authentication = await this.webAuthnService.authenticateAsync(authSession);
        } catch (error: unknown) {
            if (error instanceof WebAuthnRequestDeniedError) {
                const result: IAuthenticationFailureResult = {
                    requestId: authSession.auth_request_id,
                    authenticationMethod: "passkey",
                    succeeded: false,
                    failureReason: "declined"
                };

                return result;
            }

            throw error;
        }

        const webAuthnResult = await this.apiClient.completeWebAuthnAuthenticationAsync({
            authenticatorResponseData: JSON.stringify(authentication.authenticator_response_data),
            authRequestId: authentication.auth_request_id,
            authArmorSignature: authentication.aa_sig,
            webAuthnClientId: this.webAuthnClientId
        });

        const result: IAuthenticationSuccessResult = {
            succeeded: true,
            requestId: webAuthnResult.auth_request_id,
            authenticationMethod: "passkey",
            username,
            validationToken: webAuthnResult.auth_validation_token
        };

        return result;
    }

    /**
     * Registers a user using an authenticator QR code.
     *
     * @param username The username of the user.
     * @param options The options to use for this request.
     * @param abortSignal The abort signal to use for this request.
     *
     * @returns A promise that resolves with a QR code result for the registration result.
     */
    public async registerWithAuthenticatorQrCodeAsync(
        username: string,
        {
            actionName = "Log in",
            shortMessage = "Registration pending, please authorize",
            timeoutSeconds = 120
        }: Partial<IAuthenticatorRegisterOptions> = {},
        abortSignal?: AbortSignal
    ): Promise<QrCodeResult<RegistrationResult>> {
        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const registrationSession = await this.apiClient.startAuthenticatorRegistrationAsync({
            username,
            actionName,
            shortMessage,
            timeoutSeconds,
            nonce
        });

        const result: QrCodeResult<RegistrationResult> = {
            qrCodeUrl: registrationSession.qr_code_data,
            verificationCode: null,
            resultAsync: async () =>
                await this.pollForRegistrationResultAsync(
                    "authenticator",
                    registrationSession.registration_id,
                    username,
                    registrationSession.registration_validation_token,
                    timeoutSeconds,
                    abortSignal
                )
        };

        return result;
    }

    /**
     * Sends a register magic link to the user's email address.
     *
     * @param emailAddress The email address of the user.
     * @param redirectUrl The URL to redirect to after the user has logged in.
     * @param options The options to use for this request.
     * @param captchaConfirmationRequest The CAPTCHA confirmation.
     *
     * @returns A promise that resolves with the registration result.
     *
     * @remarks
     * The user will be redirected to the specified URL after they have registered. The validation
     * token and registration ID will be added as query parameters with the names
     * `registration_validation_token` and `registration_id` respectively.
     *
     * The validation token will not be included in the returned `RegistrationResult`.
     */
    public async sendRegisterMagicLinkEmailAsync(
        emailAddress: string,
        redirectUrl: string,
        {
            context = {},
            actionName = "Register",
            shortMessage = "Registration pending, please authorize",
            timeoutSeconds = 300
        }: Partial<IMagicLinkEmailRegisterOptions> = {},
        captchaConfirmationRequest?: ICaptchaConfirmationRequest,
        abortSignal?: AbortSignal
    ): Promise<RegistrationResult> {
        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const registrationSession = await this.apiClient.sendMagicLinkEmailForRegistrationAsync(
            {
                username: emailAddress,
                redirectUrl,
                context,
                actionName,
                shortMessage,
                timeoutSeconds,
                nonce
            },
            captchaConfirmationRequest
        );

        const result: RegistrationResult = await this.pollForRegistrationResultAsync(
            "magicLinkEmail",
            registrationSession.registration_id,
            emailAddress,
            "",
            timeoutSeconds,
            abortSignal
        );

        return result;
    }

    /**
     * Registers a user using a passkey.
     *
     * @param username The username of the user.
     * @param options The options to use for this request.
     *
     * @returns A promise that resolves with the registration result.
     */
    public async registerWithPasskeyAsync(
        username: string,
        {
            attachmentType = "any",
            residentKeyRequirementType = "required",
            userVerificationRequirementType = "required"
        }: Partial<IPasskeyRegisterOptions> = {}
    ): Promise<RegistrationResult> {
        if (this.webAuthnClientId === null) {
            throw new Error(
                "This AuthArmorClient was not instantiated with passkey support because a WebAuthn client ID was not provided."
            );
        }

        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const attachmentTypeMap: Record<IPasskeyRegisterOptions["attachmentType"], IStartWebAuthnRegistrationRequest["attachmentType"]> = {
            any: "Any",
            crossPlatform: "CrossPlatform",
            platform: "Platform"
        };

        const registrationSession = await this.apiClient.startWebAuthnRegistrationAsync({
            username,
            attachmentType: attachmentTypeMap[attachmentType],
            residentKeyRequirementType,
            userVerificationRequirementType,
            webAuthnClientId: this.webAuthnClientId,
            nonce
        });

        let registration: IPasskeyRegistration;

        try {
            registration = await this.webAuthnService.registerAsync(registrationSession);
        } catch {
            const result: IRegistrationFailureResult = {
                registrationId: registrationSession.registration_id,
                authenticationMethod: "passkey",
                succeeded: false,
                failureReason: "unknown"
            };

            return result;
        }

        const webAuthnResult = await this.apiClient.completeWebAuthnRegistrationAsync({
            authenticatorResponseData: registration.authenticator_response_data,
            registrationId: registration.registration_id,
            authArmorSignature: registration.aa_sig,
            webAuthnClientId: this.webAuthnClientId
        });

        const result: IRegistrationSuccessResult = {
            registrationId: registrationSession.registration_id,
            authenticationMethod: "passkey",
            succeeded: true,
            username,
            validationToken: webAuthnResult.registration_validation_token
        };

        return result;
    }

    /**
     * Polls the API for the status of an authenticator authentication request.
     *
     * @param sessionId The ID of the authentication session.
     * @param validationToken The validation token for the authentication session.
     * @param timeoutSeconds The number of seconds to wait before timing out.
     * @param abortSignal The abort signal to use for this request.
     *
     * @returns A promise that resolves with the authentication result.
     */
    protected pollForAuthenticationResultAsync(
        authenticationMethod: AuthenticationMethod,
        sessionId: string,
        validationToken: string,
        timeoutSeconds: number = 60,
        abortSignal?: AbortSignal
    ): Promise<AuthenticationResult> {
        return new Promise((resolve, reject) => {
            const timesOutAfter = this.systemClock.now().getTime() + timeoutSeconds * 1000;

            const interval = setInterval(async () => {
                if (abortSignal?.aborted) {
                    clearInterval(interval);

                    reject(abortSignal.reason);

                    return;
                }

                if (this.systemClock.now().getTime() > timesOutAfter) {
                    clearInterval(interval);

                    const result: IAuthenticationFailureResult = {
                        requestId: sessionId,
                        authenticationMethod,
                        succeeded: false,
                        failureReason: "timedOut"
                    };

                    resolve(result);

                    return;
                }

                const status = await this.apiClient.getAuthenticationSessionStatusAsync({
                    sessionId
                });

                if (status.auth_response_code === ApiModels.AuthenticationRequestCode.Succeeded) {
                    clearInterval(interval);

                    const result: IAuthenticationSuccessResult = {
                        requestId: sessionId,
                        authenticationMethod,
                        succeeded: true,
                        username: status.username!,
                        validationToken
                    };

                    resolve(result);
                } else if (
                    status.auth_request_status_id === ApiModels.AuthenticationRequestStatusId.Failed
                ) {
                    clearInterval(interval);

                    const failureReason = this.getAuthenticationFailureReason(
                        status.auth_response_code
                    );

                    const result: IAuthenticationFailureResult = {
                        requestId: sessionId,
                        authenticationMethod,
                        succeeded: false,
                        failureReason
                    };

                    resolve(result);
                }
            }, 1000);
        });
    }

    /**
     * Polls the API for the status of a registration request.
     *
     * @param userId The ID of the user.
     * @param timeoutSeconds The number of seconds after which to consider the request timed out.
     * @param abortSignal The abort signal to use for this request.
     *
     * @returns A promise that resolves with the registration result.
     */
    protected pollForRegistrationResultAsync(
        authenticationMethod: AuthenticationMethod,
        registrationId: string,
        username: string,
        validationToken: string,
        timeoutSeconds: number = 60,
        abortSignal?: AbortSignal
    ): Promise<RegistrationResult> {
        return new Promise((resolve, reject) => {
            const timesOutAfter = this.systemClock.now().getTime() + timeoutSeconds * 1000;

            const interval = setInterval(async () => {
                if (abortSignal?.aborted) {
                    clearInterval(interval);

                    reject(abortSignal.reason);

                    return;
                }

                if (this.systemClock.now().getTime() > timesOutAfter) {
                    clearInterval(interval);

                    const result: IRegistrationFailureResult = {
                        registrationId,
                        authenticationMethod,
                        succeeded: false,
                        failureReason: "timedOut"
                    };

                    resolve(result);

                    return;
                }

                const registrationSessionStatus =
                    await this.apiClient.getRegistrationSessionStatusAsync({
                        registrationId
                    });

                switch (registrationSessionStatus.registration_status_code) {
                    case ApiModels.RegistrationRequestStatusCode.PendingValidation:
                    case ApiModels.RegistrationRequestStatusCode.Registered: {
                        clearInterval(interval);

                        const result: IRegistrationSuccessResult = {
                            registrationId,
                            authenticationMethod,
                            succeeded: true,
                            username,
                            validationToken
                        };

                        resolve(result);

                        break;
                    }

                    case ApiModels.RegistrationRequestStatusCode.Declined: {
                        clearInterval(interval);

                        const result: IRegistrationFailureResult = {
                            registrationId,
                            authenticationMethod: "authenticator",
                            succeeded: false,
                            failureReason: "declined"
                        };

                        resolve(result);

                        break;
                    }

                    case ApiModels.RegistrationRequestStatusCode.Timeout: {
                        clearInterval(interval);

                        const result: IRegistrationFailureResult = {
                            registrationId,
                            authenticationMethod: "authenticator",
                            succeeded: false,
                            failureReason: "timedOut"
                        };

                        resolve(result);

                        break;
                    }

                    case ApiModels.RegistrationRequestStatusCode.PendingUserAcceptance:
                    case ApiModels.RegistrationRequestStatusCode.AcceptedPendingDeviceEnrollment: {
                        break;
                    }

                    default: {
                        clearInterval(interval);

                        const result: IRegistrationFailureResult = {
                            registrationId,
                            authenticationMethod: "authenticator",
                            succeeded: false,
                            failureReason: "unknown"
                        };

                        resolve(result);

                        break;
                    }
                }
            }, 1000);
        });
    }

    /**
     * Gets the failure reason for an authentication request.
     *
     * @param responseCode The response code returned by the API.
     *
     * @returns The failure reason.
     */
    private getAuthenticationFailureReason(
        responseCode: ApiModels.AuthenticationRequestCode
    ): AuthenticationFailureReason {
        switch (responseCode) {
            case ApiModels.AuthenticationRequestCode.TimedOut: {
                return "timedOut";
            }

            case ApiModels.AuthenticationRequestCode.Declined: {
                return "declined";
            }

            default: {
                return "unknown";
            }
        }
    }

    /**
     * Initializes the client for making requests.
     *
     * @returns A promise that resolves when the client has been initialized
     */
    private async initializeInternal(): Promise<void> {
        const remoteSdkConfig = await this.apiClient.getSdkConfigurationAsync();

        this.hCaptchaSiteId = remoteSdkConfig.hcaptcha_site_id;
    }
}

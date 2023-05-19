import { AuthArmorApiClient } from "../api/AuthArmorApiClient";
import * as ApiModels from "../api/models";
import { BrowserNonceGenerator } from "../infrastructure/BrowserNonceGenerator";
import { INonceGenerator } from "../infrastructure/INonceGenerator";
import { GoogleReCaptchaService } from "../infrastructure/GoogleReCaptchaService";
import { IReCaptchaService } from "../infrastructure/IReCaptchaService";
import { BlankReCaptchaService } from "../infrastructure/BlankReCaptchaService";
import { ISystemClock } from "../infrastructure/ISystemClock";
import { NativeSystemClock } from "../infrastructure/NativeSystemClock";
import {
    AuthenticationFailureReason,
    AuthenticationResult,
    IAuthenticationFailureResult,
    IAuthenticationSuccessResult,
    IAvailableAuthenticationMethods,
    IRegistrationFailureResult,
    IRegistrationSuccessResult,
    QrCodeResult,
    RegistrationResult
} from "./models";
import { AuthArmorClientConfiguration } from "./config";
import { WebAuthnService } from "../webAuthn/WebAuthnService";
import { IWebAuthnLogIn, IWebAuthnRegistration } from "../webAuthn/models";

/**
 * The client for programatically interacting with AuthArmor's client-side SDK.
 */
export class AuthArmorClient {
    /**
     * Indicates whether the client has been initialized for making requests.
     */
    private isInitialized: boolean = false;

    /**
     * The ReCaptcha service.
     */
    private reCaptchaService: IReCaptchaService = null!;

    /**
     * @param configuration The configuration for the client.
     * @param apiClient The API client for making requests to the AuthArmor API.
     * @param nonceGenerator The nonce generator.
     * @param systemClock The system clock.
     */
    public constructor(
        configuration: AuthArmorClientConfiguration,
        private readonly apiClient = new AuthArmorApiClient(configuration),
        private readonly webAuthnClientId: string | null = configuration.webAuthnClientId ?? null,
        private readonly webAuthnService = configuration.webAuthnClientId !== undefined
            ? new WebAuthnService(configuration.webAuthnClientId)
            : null!,
        private readonly nonceGenerator: INonceGenerator = new BrowserNonceGenerator(),
        private readonly systemClock: ISystemClock = new NativeSystemClock()
    ) {}

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
        if (this.isInitialized) {
            return;
        }

        const remoteSdkConfig = await this.apiClient.getSdkConfigurationAsync();

        if (remoteSdkConfig.google_v3_recaptcha_enabled) {
            const reCaptchaService = new GoogleReCaptchaService(remoteSdkConfig.google_v3_recpatcha_site_id);
            await reCaptchaService.initializeAsync();

            this.reCaptchaService = reCaptchaService;
        } else {
            this.reCaptchaService = new BlankReCaptchaService();
        }

        this.isInitialized = true;
    }

    /**
     * Gets the available authentication methods for a user.
     *
     * @param username The username of the user.
     *
     * @returns A promise that resolves with the available authentication methods.
     */
    public async getAvailableLogInMethodsAsync(
        username: string
    ): Promise<IAvailableAuthenticationMethods> {
        await this.ensureInitialized();

        const userEnrollments = await this.apiClient.getUserEnrollmentsAsync({ username });

        const authMethods = userEnrollments.enrolled_auth_methods.map((m) => m.auth_method_id);

        const result: IAvailableAuthenticationMethods = {
            authenticator: authMethods.includes(ApiModels.AuthMethod.Authenticator),
            emailMagicLink: authMethods.includes(ApiModels.AuthMethod.EmailMagicLink),
            webAuthn: authMethods.includes(ApiModels.AuthMethod.WebAuthn)
        };

        return result;
    }

    /**
     * Logs in a user using an authenticator notification.
     *
     * @param username The username of the user.
     *
     * @returns A promise that resolves with the authentication result.
     */
    public async logInWithAuthenticatorNotificationAsync(
        username: string
    ): Promise<AuthenticationResult> {
        await this.ensureInitialized();

        const reCaptchaToken = await this.reCaptchaService.executeAsync("auth");
        const nonce = this.nonceGenerator.generateNonce();

        const authSession = await this.apiClient.startAuthenticatorNotificationAuthenticationAsync({
            username,
            useVisualVerify: false,
            timeoutSeconds: 60,
            reCaptchaToken,
            nonce
        });

        const result = await this.pollForAuthenticationResultAsync(
            authSession.auth_request_id,
            authSession.auth_validation_token
        );

        return result;
    }

    /**
     * Logs in a user using an authenticator QR code.
     *
     * @returns A promise that resolves with a QR code result for the authentication result.
     */
    public async logInWithAuthenticatorQrCodeAsync(): Promise<QrCodeResult<AuthenticationResult>> {
        await this.ensureInitialized();

        const reCaptchaToken = await this.reCaptchaService.executeAsync("auth");
        const nonce = this.nonceGenerator.generateNonce();

        const authSession = await this.apiClient.startAuthenticatorQrCodeAuthenticationAsync({
            useVisualVerify: false,
            timeoutSeconds: 60,
            reCaptchaToken,
            nonce
        });

        const result: QrCodeResult<AuthenticationResult> = {
            qrCodeUrl: authSession.qr_code_data,
            resultAsync: async () =>
                await this.pollForAuthenticationResultAsync(
                    authSession.auth_request_id,
                    authSession.auth_validation_token
                )
        };

        return result;
    }

    /**
     * Sends a login magic link to the user's email address.
     *
     * @param emailAddress The email address of the user.
     * @param redirectUrl The URL to redirect to after the user has logged in.
     *
     * @returns A promise that resolves when the magic link has been sent.
     *
     * @remarks
     * The user will be redirected to the specified URL after they have logged in. The URL will
     * contain a query string parameter named `auth_validation_token` that can be used to validate
     * the login.
     */
    public async sendLoginMagicLinkAsync(emailAddress: string, redirectUrl: string): Promise<void> {
        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        await this.apiClient.sendMagicLinkForAuthenticationAsync({
            username: emailAddress,
            redirectUrl,
            timeoutSeconds: 60,
            nonce
        });
    }

    /**
     * Logs in a user using WebAuthn.
     *
     * @param username The username of the user.
     *
     * @returns A promise that resolves with the authentication result.
     */
    public async logInWithWebAuthnAsync(username: string): Promise<AuthenticationResult> {
        if (this.webAuthnClientId === null) {
            throw new Error("This AuthArmorClient was not instantiated with WebAuthn support");
        }

        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const authSession = await this.apiClient.startWebAuthnAuthenticationAsync({
            username,
            webAuthnClientId: this.webAuthnClientId,
            attachmentType: "Any",
            nonce
        });

        let logIn: IWebAuthnLogIn;

        try {
            logIn = await this.webAuthnService.logInAsync(authSession);
        } catch {
            const result: IAuthenticationFailureResult = {
                requestId: authSession.auth_request_id,
                succeeded: false,
                failureReason: "unknown"
            };

            return result;
        }

        const webAuthnResult = await this.apiClient.completeWebAuthnAuthenticationAsync({
            authenticatorResponseData: logIn.authenticator_response_data,
            authRequestId: logIn.auth_request_id,
            authArmorSignature: logIn.aa_sig,
            webAuthnClientId: this.webAuthnClientId
        });

        const result: IAuthenticationSuccessResult = {
            succeeded: true,
            requestId: webAuthnResult.auth_request_id,
            validationToken: webAuthnResult.auth_validation_token
        };

        return result;
    }

    /**
     * Registers a user using an authenticator QR code.
     *
     * @param username The username of the user.
     *
     * @returns A promise that resolves with a QR code result for the registration result.
     */
    public async registerWithAuthenticatorQrCodeAsync(
        username: string
    ): Promise<QrCodeResult<RegistrationResult>> {
        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const registrationSession = await this.apiClient.startAuthenticatorRegistrationAsync({
            username,
            timeoutSeconds: 60,
            nonce
        });

        const result: QrCodeResult<RegistrationResult> = {
            qrCodeUrl: registrationSession.qr_code_data,
            resultAsync: async () =>
                await this.pollForAuthenticatorRegistrationResultAsync(registrationSession.user_id)
        };

        return result;
    }

    /**
     * Sends a register magic link to the user's email address.
     *
     * @param emailAddress The email address of the user.
     * @param redirectUrl The URL to redirect to after the user has logged in.
     *
     * @returns A promise that resolves when the magic link has been sent.
     *
     * @remarks
     * The user will be redirected to the specified URL after they have logged in. The URL will
     * contain a query string parameter named `registration_validation_token` that can be used to
     * validate the registration.
     */
    public async sendRegisterMagicLinkAsync(
        emailAddress: string,
        redirectUrl: string
    ): Promise<void> {
        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        await this.apiClient.sendMagicLinkForRegistrationAsync({
            username: emailAddress,
            redirectUrl,
            timeoutSeconds: 60,
            nonce
        });
    }

    /**
     * Registers a user using WebAuthn.
     *
     * @param username The username of the user.
     *
     * @returns A promise that resolves with the registration result.
     */
    public async registerWithWebAuthnAsync(username: string): Promise<RegistrationResult> {
        if (this.webAuthnClientId === null) {
            throw new Error("This AuthArmorClient was not instantiated with WebAuthn support");
        }

        await this.ensureInitialized();

        const nonce = this.nonceGenerator.generateNonce();

        const registrationSession = await this.apiClient.startWebAuthnRegistrationAsync({
            username,
            attachmentType: "Any",
            webAuthnClientId: this.webAuthnClientId,
            timeoutSeconds: 60,
            nonce
        });

        let registration: IWebAuthnRegistration;

        try {
            registration = await this.webAuthnService.registerAsync(registrationSession);
        } catch {
            const result: IRegistrationFailureResult = {
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
            succeeded: true,
            userId: webAuthnResult.user_id,
            username: webAuthnResult.username ?? username
        };

        return result;
    }

    /**
     * Polls the API for the status of an authentication request.
     *
     * @param sessionId The ID of the authentication session.
     * @param validationToken The validation token for the authentication session.
     * @param timeoutSeconds The number of seconds to wait before timing out.
     *
     * @returns A promise that resolves with the authentication result.
     */
    protected pollForAuthenticationResultAsync(
        sessionId: string,
        validationToken: string,
        timeoutSeconds: number = 60
    ): Promise<AuthenticationResult> {
        return new Promise((resolve) => {
            const timesOutAfter = this.systemClock.now().getTime() + timeoutSeconds * 1000;

            const interval = setInterval(async () => {
                if (this.systemClock.now().getTime() > timesOutAfter) {
                    clearInterval(interval);

                    const result: IAuthenticationFailureResult = {
                        requestId: sessionId,
                        succeeded: false,
                        failureReason: "timedOut"
                    };

                    resolve(result);

                    return;
                }

                const status = await this.apiClient.getAuthenticationSessionStatusAsync({
                    sessionId
                });

                if (
                    status.auth_request_status_id ===
                        ApiModels.AuthenticationRequestStatusId.PendingValidation &&
                    status.auth_response_code === ApiModels.AuthenticationRequestCode.Succeeded
                ) {
                    clearInterval(interval);

                    const result: IAuthenticationSuccessResult = {
                        requestId: sessionId,
                        succeeded: true,
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
     *
     * @returns A promise that resolves with the registration result.
     */
    protected pollForAuthenticatorRegistrationResultAsync(
        userId: string,
        timeoutSeconds: number = 60
    ): Promise<RegistrationResult> {
        return new Promise((resolve) => {
            const timesOutAfter = this.systemClock.now().getTime() + timeoutSeconds * 1000;

            const interval = setInterval(async () => {
                if (this.systemClock.now().getTime() > timesOutAfter) {
                    clearInterval(interval);

                    const result: IRegistrationFailureResult = {
                        succeeded: false,
                        failureReason: "timedOut"
                    };

                    resolve(result);

                    return;
                }

                const enrollmentStatus = await this.apiClient.getAuthenticatorEnrollmentStatusAsync(
                    { userId }
                );

                if (enrollmentStatus.authenticator_enrollment_status === "enrolled") {
                    clearInterval(interval);

                    const result: IRegistrationSuccessResult = {
                        succeeded: true,
                        userId: enrollmentStatus.user_id,
                        username: enrollmentStatus.username
                    };

                    resolve(result);
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
}

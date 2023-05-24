import { ApiError } from "../api";
import {
    AuthArmorClient,
    AuthenticationResult,
    IAuthenticatorRegisterOptions,
    IAuthenticatorUserSpecificLogInOptions,
    IAvailableAuthenticationMethods,
    IEmailMagicLinkLogInOptions,
    IEmailMagicLinkRegisterOptions,
    IWebAuthnRegisterOptions,
    QrCodeResult,
    RegistrationResult
} from "../client";
import { createAuthStatusDialog } from "./dialogs/createAuthStatusDialog";
import { selectAuthenticationMethod } from "./dialogs/selectAuthenticationMethod";
import { IAuthArmorInteractiveClientConfiguration } from "./config/IAuthArmorInteractiveClientConfiguration";

export class AuthArmorInteractiveClient {
    public constructor(
        private readonly client: AuthArmorClient,
        private readonly configuration: IAuthArmorInteractiveClientConfiguration = {}
    ) {}

    public async logInAsync(
        username: string,
        abortSignal?: AbortSignal
    ): Promise<AuthenticationResult | null> {
        const selectedMethod = await this.selectLogInMethodAsync(username, abortSignal);

        switch (selectedMethod) {
            case "authenticator": {
                return await this.logInWithAuthenticatorAsync(username, {}, abortSignal);
            }

            case "webAuthn": {
                return await this.logInWithWebAuthnAsync(username, abortSignal);
            }

            case "emailMagicLink": {
                await this.logInWithEmailMagicLinkAsync(username, undefined, {}, abortSignal);
                return null;
            }
        }
    }

    public async selectLogInMethodAsync(
        username: string,
        abortSignal?: AbortSignal
    ): Promise<keyof IAvailableAuthenticationMethods> {
        const methods: IAvailableAuthenticationMethods =
            await this.client.getAvailableLogInMethodsAsync(username);

        const selectedMethod = await selectAuthenticationMethod(methods, abortSignal);

        return selectedMethod;
    }

    public async logInWithAuthenticatorAsync(
        username: string,
        options: Partial<IAuthenticatorUserSpecificLogInOptions> = {},
        abortSignal?: AbortSignal
    ): Promise<AuthenticationResult> {
        const abortController = new AbortController();
        const abortHandler = (reason: any) => abortController.abort(reason);
        abortSignal?.addEventListener("abort", abortHandler);

        const [_, { setTitle, setStatusMessage, setStatusType, setAuthenticationUrl }] =
            createAuthStatusDialog(abortController.signal, abortController);

        setTitle("We've sent a push message to your device(s)");
        setStatusMessage("Sending");

        let qrResult: QrCodeResult<AuthenticationResult>;

        try {
            qrResult = await this.client.logInWithAuthenticatorAsync(
                username,
                {
                    ...this.configuration.defaultLogInOptions,
                    ...this.configuration.defaultAuthenticatorLogInOptions,
                    ...options
                },
                abortController.signal
            );
        } catch (error: unknown) {
            abortController.signal.throwIfAborted();

            setStatusType("error");

            if (error instanceof ApiError) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("Unknown error");
            }

            throw error;
        }

        setStatusMessage("Please check your device");
        setAuthenticationUrl(qrResult.qrCodeUrl);

        let authenticationResult: AuthenticationResult;

        try {
            authenticationResult = await qrResult.resultAsync();
        } catch (error: unknown) {
            abortController.signal.throwIfAborted();

            setStatusType("error");
            setAuthenticationUrl(null);

            if (error instanceof ApiError) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("Unknown error");
            }

            throw error;
        }

        if (authenticationResult.succeeded) {
            setStatusMessage("Approved");
            setStatusType("success");

            setTimeout(() => abortController.abort(), 1000);
        } else {
            setStatusMessage(authenticationResult.failureReason);
            setStatusType("error");
        }

        abortSignal?.removeEventListener("abort", abortHandler);

        return authenticationResult;
    }

    public async logInWithWebAuthnAsync(
        username: string,
        abortSignal?: AbortSignal
    ): Promise<AuthenticationResult> {
        const abortController = new AbortController();
        const abortHandler = (reason: any) => abortController.abort(reason);
        abortSignal?.addEventListener("abort", abortHandler);

        const [_, { setTitle, setStatusMessage, setStatusType }] = createAuthStatusDialog(
            abortController.signal,
            abortController
        );

        setTitle("We've sent an authentication request to your device");
        setStatusMessage("Authenticate on device");

        let authenticationResult: AuthenticationResult;

        try {
            authenticationResult = await this.client.logInWithWebAuthnAsync(username);
        } catch (error: unknown) {
            abortController.signal.throwIfAborted();

            setStatusType("error");

            if (error instanceof ApiError) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("Unknown error");
            }

            throw error;
        }

        if (authenticationResult.succeeded) {
            setStatusMessage("Approved");
            setStatusType("success");

            setTimeout(() => abortController.abort(), 1000);
        } else {
            setStatusMessage(authenticationResult.failureReason);
            setStatusType("error");
        }

        abortSignal?.removeEventListener("abort", abortHandler);

        return authenticationResult;
    }

    public async logInWithEmailMagicLinkAsync(
        emailAddress: string,
        redirectUrl?: string,
        options: Partial<IEmailMagicLinkLogInOptions> = {},
        abortSignal?: AbortSignal
    ): Promise<void> {
        const abortController = new AbortController();
        const abortHandler = (reason: any) => abortController.abort(reason);
        abortSignal?.addEventListener("abort", abortHandler);

        const [_, { setTitle, setStatusMessage, setStatusType }] = createAuthStatusDialog(
            abortController.signal,
            abortController
        );

        setTitle("We've sent you an email magic link to log you in");
        setStatusMessage("Sending");

        const finalRedirectUrl = redirectUrl ?? this.configuration.emailMagicLinkRedirectUrl;

        if (finalRedirectUrl === undefined) {
            setStatusMessage("No redirect link");
            setStatusType("error");

            throw new Error("Redirect link not specified.");
        }

        try {
            await this.client.sendLoginMagicLinkAsync(emailAddress, finalRedirectUrl, {
                ...this.configuration.defaultLogInOptions,
                ...this.configuration.defaultEmailMagicLinkLogInOptions,
                ...options
            });
        } catch (error: unknown) {
            abortController.signal.throwIfAborted();

            setStatusType("error");

            if (error instanceof ApiError) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("Unknown error");
            }

            throw error;
        }

        setStatusMessage("Please check your email");

        abortSignal?.removeEventListener("abort", abortHandler);
    }

    public async registerAsync(
        username: string,
        abortSignal?: AbortSignal
    ): Promise<RegistrationResult | null> {
        const selectedMethod = await this.selectRegistrationMethodAsync(abortSignal);

        switch (selectedMethod) {
            case "authenticator": {
                return await this.registerWithAuthenticatorAsync(username, {}, abortSignal);
            }

            case "webAuthn": {
                return await this.registerWithWebAuthnAsync(username, {}, abortSignal);
            }

            case "emailMagicLink": {
                await this.registerWithEmailMagicLinkAsync(username, undefined, {}, abortSignal);
                return null;
            }
        }
    }

    public async selectRegistrationMethodAsync(
        abortSignal?: AbortSignal
    ): Promise<keyof IAvailableAuthenticationMethods> {
        const methods: IAvailableAuthenticationMethods = {
            authenticator: true,
            emailMagicLink: true,
            webAuthn: true
        };

        const selectedMethod = await selectAuthenticationMethod(methods, abortSignal);

        return selectedMethod;
    }

    public async registerWithAuthenticatorAsync(
        username: string,
        options: Partial<IAuthenticatorRegisterOptions> = {},
        abortSignal?: AbortSignal
    ): Promise<RegistrationResult> {
        const abortController = new AbortController();
        const abortHandler = (reason: any) => abortController.abort(reason);
        abortSignal?.addEventListener("abort", abortHandler);

        const [_, { setTitle, setStatusMessage, setStatusType, setAuthenticationUrl }] =
            createAuthStatusDialog(abortController.signal, abortController);

        setTitle("We're making a QR code to register your device");
        setStatusMessage("Please wait");

        let qrResult: QrCodeResult<RegistrationResult>;

        try {
            qrResult = await this.client.registerWithAuthenticatorQrCodeAsync(
                username,
                {
                    ...this.configuration.defaultRegisterOptions,
                    ...this.configuration.defaultAuthenticatorRegisterOptions,
                    ...options
                },
                abortController.signal
            );
        } catch (error: unknown) {
            abortController.signal.throwIfAborted();

            setStatusType("error");

            if (error instanceof ApiError) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("Unknown error");
            }

            throw error;
        }

        setStatusMessage("Please scan the QR code with your phone");
        setAuthenticationUrl(qrResult.qrCodeUrl);

        let registrationResult: RegistrationResult;

        try {
            registrationResult = await qrResult.resultAsync();
        } catch (error: unknown) {
            abortController.signal.throwIfAborted();

            setStatusType("error");
            setAuthenticationUrl(null);

            if (error instanceof ApiError) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("Unknown error");
            }

            throw error;
        }

        if (registrationResult.succeeded) {
            setStatusMessage("Registered");
            setStatusType("success");

            setTimeout(() => abortController.abort(), 1000);
        } else {
            setStatusMessage(registrationResult.failureReason);
            setStatusType("error");
        }

        abortSignal?.removeEventListener("abort", abortHandler);

        return registrationResult;
    }

    public async registerWithWebAuthnAsync(
        username: string,
        options: Partial<IWebAuthnRegisterOptions> = {},
        abortSignal?: AbortSignal
    ): Promise<RegistrationResult> {
        const abortController = new AbortController();
        const abortHandler = (reason: any) => abortController.abort(reason);
        abortSignal?.addEventListener("abort", abortHandler);

        const [_, { setTitle, setStatusMessage, setStatusType }] = createAuthStatusDialog(
            abortController.signal,
            abortController
        );

        setTitle("We've sent a registration request to your device");
        setStatusMessage("Register on device");

        let registrationResult: RegistrationResult;

        try {
            registrationResult = await this.client.registerWithWebAuthnAsync(username, {
                ...this.configuration.defaultRegisterOptions,
                ...this.configuration.defaultWebAuthnRegisterOptions,
                ...options
            });
        } catch (error: unknown) {
            abortController.signal.throwIfAborted();

            setStatusType("error");

            if (error instanceof ApiError) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("Unknown error");
            }

            throw error;
        }

        if (registrationResult.succeeded) {
            setStatusMessage("Registered");
            setStatusType("success");

            setTimeout(() => abortController.abort(), 1000);
        } else {
            setStatusMessage(registrationResult.failureReason);
            setStatusType("error");
        }

        abortSignal?.removeEventListener("abort", abortHandler);

        return registrationResult;
    }

    public async registerWithEmailMagicLinkAsync(
        emailAddress: string,
        redirectUrl?: string,
        options: Partial<IEmailMagicLinkRegisterOptions> = {},
        abortSignal?: AbortSignal
    ): Promise<void> {
        const abortController = new AbortController();
        const abortHandler = (reason: any) => abortController.abort(reason);
        abortSignal?.addEventListener("abort", abortHandler);

        const [_, { setTitle, setStatusMessage, setStatusType }] = createAuthStatusDialog(
            abortController.signal,
            abortController
        );

        setTitle("We've sent you an email magic link to register yourself");
        setStatusMessage("Sending");

        const finalRedirectUrl = redirectUrl ?? this.configuration.emailMagicLinkRedirectUrl;

        if (finalRedirectUrl === undefined) {
            setStatusMessage("No redirect link");
            setStatusType("error");

            throw new Error("Redirect link not specified.");
        }

        try {
            await this.client.sendRegisterMagicLinkAsync(emailAddress, finalRedirectUrl, {
                ...this.configuration.defaultRegisterOptions,
                ...this.configuration.defaultEmailMagicLinkRegisterOptions,
                ...options
            });
        } catch (error: unknown) {
            abortController.signal.throwIfAborted();

            setStatusType("error");

            if (error instanceof ApiError) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("Unknown error");
            }

            throw error;
        }

        setStatusMessage("Please check your email");

        abortSignal?.removeEventListener("abort", abortHandler);
    }
}

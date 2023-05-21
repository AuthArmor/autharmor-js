import { Match, Show, Switch, createSignal } from "solid-js";
import { useClient } from "./context/useClient";
import {
    IAvailableAuthenticationMethods,
    IRegistrationSuccessResult,
    RegistrationFailureReason
} from "../client";
import { Dialog, DialogStatusType } from "./common/Dialog";
import { AuthenticationMethodPicker } from "./common/AuthenticationMethodPicker";
import { ApiError } from "../api";
import { QrCode } from "./common/QrCode";

export interface RegistrationFormProps {
    enableAuthenticator: boolean;
    enableEmailMagicLink: boolean;
    enableWebAuthn: boolean;

    magicLinkRedirectUrl?: string;

    onRegister: (registrationResult: IRegistrationSuccessResult) => void;
}

export function RegistrationForm(props: RegistrationFormProps) {
    const client = useClient();

    let currentRequestAbortController: AbortController | null = null;

    const [activeMethod, setActiveMethod] = createSignal<
        keyof IAvailableAuthenticationMethods | null
    >(null);
    const [status, setStatus] = createSignal<DialogStatusType>("waiting");
    const [registrationUrl, setRegistrationUrl] = createSignal<string | null>(null);
    const [dialogError, setDialogError] = createSignal<string | null>(null);
    const [error, setError] = createSignal<string | null>(null);

    const [isSelectingMethod, setIsSelectingMethod] = createSignal(false);
    const [availableMethods, setAvailableMethods] = createSignal<IAvailableAuthenticationMethods>({
        authenticator: false,
        emailMagicLink: false,
        webAuthn: false
    });
    let methodSelectedHandler:
        | ((method: keyof IAvailableAuthenticationMethods | null) => void)
        | null = null;
    let methodSelectorDismissedHandler: (() => void) | null = null;

    let usernameTextbox: HTMLInputElement = undefined!;

    const selectRegistrationMethod = (
        availableMethods: IAvailableAuthenticationMethods
    ): Promise<keyof IAvailableAuthenticationMethods | null> => {
        return new Promise((resolve) => {
            const methodCount = Object.values(availableMethods).reduce(
                (prev, curr) => prev + (curr ? 1 : 0),
                0
            );

            if (methodCount === 0) {
                resolve(null);
                return;
            } else if (methodCount === 1) {
                const method = (
                    Object.keys(availableMethods) as (keyof IAvailableAuthenticationMethods)[]
                ).find((method) => availableMethods[method] === true)!;

                resolve(method);
                return;
            }

            setIsSelectingMethod(true);
            setAvailableMethods(availableMethods);

            const clearSelector = () => {
                setIsSelectingMethod(false);

                methodSelectedHandler = null;
                methodSelectorDismissedHandler = null;
            };

            methodSelectedHandler = (method) => {
                clearSelector();
                resolve(method);
            };

            methodSelectorDismissedHandler = () => {
                clearSelector();
                resolve(null);
            };
        });
    };

    const handleMethodSelected = (method: keyof IAvailableAuthenticationMethods) => {
        methodSelectedHandler?.(method);
    };

    const handleMethodSelectorDismissed = () => {
        methodSelectorDismissedHandler?.();
    };

    const handleRegister = async (event: Event) => {
        event.preventDefault();

        currentRequestAbortController?.abort();
        currentRequestAbortController = new AbortController();

        const abortSignal = currentRequestAbortController.signal;

        setActiveMethod(null);
        setStatus("waiting");
        setRegistrationUrl(null);
        setError(null);
        setDialogError(null);

        const username = usernameTextbox.value;

        if (username === "") {
            setError("Username is empty");

            currentRequestAbortController = null;

            return;
        }

        const availableMethods: IAvailableAuthenticationMethods = {
            authenticator: props.enableAuthenticator,
            webAuthn: props.enableWebAuthn,
            emailMagicLink: props.enableEmailMagicLink
        };

        const selectedMethod = await selectRegistrationMethod(availableMethods);

        if (abortSignal.aborted) {
            return;
        }

        setActiveMethod(selectedMethod);

        switch (selectedMethod) {
            case "authenticator": {
                const qrResult = await client.registerWithAuthenticatorQrCodeAsync(
                    username,
                    {},
                    abortSignal
                );

                if (abortSignal.aborted) {
                    return;
                }

                setRegistrationUrl(qrResult.qrCodeUrl);

                const result = await qrResult.resultAsync();

                if (abortSignal.aborted) {
                    return;
                }

                setRegistrationUrl(null);
                setStatus(result.succeeded ? "success" : "error");

                if (!result.succeeded) {
                    const humanFailureReasons: { [reason in RegistrationFailureReason]: string } = {
                        timedOut: "Request timed out",
                        aborted: "Request aborted",
                        unknown: "Unknown failure"
                    };

                    const failureReason = humanFailureReasons[result.failureReason];

                    setDialogError(failureReason);

                    currentRequestAbortController = null;

                    return;
                }

                break;
            }

            case "webAuthn": {
                const result = await client.registerWithWebAuthnAsync(username);

                if (abortSignal.aborted) {
                    return;
                }

                setStatus(result.succeeded ? "success" : "error");

                if (!result.succeeded) {
                    setDialogError("Registration failed.");

                    currentRequestAbortController = null;

                    return;
                }

                break;
            }

            case "emailMagicLink": {
                const magicLinkRedirectUrl = props.magicLinkRedirectUrl;

                if (magicLinkRedirectUrl === undefined) {
                    setStatus("error");
                    setDialogError("Magic link redirect URL not set");

                    return;
                }

                try {
                    await client.sendRegisterMagicLinkAsync(username, magicLinkRedirectUrl);
                } catch (error: unknown) {
                    if (abortSignal.aborted) {
                        return;
                    }

                    if (!(error instanceof ApiError)) {
                        throw error;
                    }

                    setStatus("error");
                    setDialogError(error.message);

                    currentRequestAbortController = null;

                    return;
                }

                setStatus("success");

                break;
            }
        }

        currentRequestAbortController = null;
    };

    const handleCurrentRequestDismissed = () => {
        currentRequestAbortController?.abort();
        currentRequestAbortController = null;

        setActiveMethod(null);
        setStatus("waiting");
        setError(null);
        setDialogError(null);
    };

    return (
        <form onSubmit={handleRegister}>
            <input type="text" ref={usernameTextbox} />
            <Show when={error() !== null}>
                <p>{error()}</p>
            </Show>
            <button type="submit">Register</button>

            <Switch>
                <Match when={activeMethod() === "authenticator"}>
                    <Dialog
                        statusMessage={
                            status() === "waiting"
                                ? registrationUrl() === null
                                    ? "Loading QR code"
                                    : "Please scan the QR code with your phone"
                                : status() === "success"
                                ? "Done"
                                : dialogError() ?? "Failed"
                        }
                        statusType={status()}
                        onClose={handleCurrentRequestDismissed}
                    >
                        <Show when={registrationUrl() !== null}>
                            <QrCode data={registrationUrl()!} />
                        </Show>
                    </Dialog>
                </Match>
                <Match when={activeMethod() === "webAuthn"}>
                    <Dialog
                        title="We've sent a registration request to your device"
                        statusMessage={
                            status() === "waiting"
                                ? "Waiting for registration"
                                : status() === "success"
                                ? "Registered"
                                : dialogError() ?? "Failed"
                        }
                        onClose={handleCurrentRequestDismissed}
                        statusType={status()}
                    />
                </Match>
                <Match when={activeMethod() === "emailMagicLink"}>
                    <Dialog
                        title="We've sent you an email magic link to register yourself"
                        statusMessage={
                            status() === "waiting"
                                ? "Sending"
                                : status() === "success"
                                ? "Email sent"
                                : dialogError() ?? "Failed"
                        }
                        statusType={status()}
                        onClose={handleCurrentRequestDismissed}
                    />
                </Match>
            </Switch>

            <Show when={isSelectingMethod()}>
                <AuthenticationMethodPicker
                    authenticationMethods={availableMethods()}
                    onAuthenticationMethodSelected={handleMethodSelected}
                    onDialogDismissed={handleMethodSelectorDismissed}
                />
            </Show>
        </form>
    );
}

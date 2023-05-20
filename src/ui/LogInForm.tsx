import { Match, Show, Switch, createSignal } from "solid-js";
import { ApiError } from "../api/errors/ApiError";
import {
    AuthenticationFailureReason,
    IAuthenticationSuccessResult,
    IAvailableAuthenticationMethods
} from "../client/models";
import { useClient } from "./context/useClient";
import { Dialog, DialogStatusType } from "./common/Dialog";
import { AuthenticationMethodPicker } from "./common/AuthenticationMethodPicker";

export interface ILogInFormProps {
    enableAuthenticator: boolean;
    enableEmailMagicLink: boolean;
    enableWebAuthn: boolean;

    magicLinkRedirectUrl?: string;

    onLogIn: (authenticationResult: IAuthenticationSuccessResult) => void;
}

export function LogInForm(props: ILogInFormProps) {
    const client = useClient();

    let currentRequestAbortController: AbortController | null = null;

    const [activeMethod, setActiveMethod] = createSignal<
        keyof IAvailableAuthenticationMethods | null
    >(null);
    const [status, setStatus] = createSignal<DialogStatusType>("waiting");
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

    const selectAuthenticationMethod = (
        methods: IAvailableAuthenticationMethods
    ): Promise<keyof IAvailableAuthenticationMethods | null> => {
        return new Promise((resolve) => {
            const methodCount = Object.values(methods).reduce(
                (prev, curr) => prev + (curr ? 1 : 0),
                0
            );

            if (methodCount === 0) {
                resolve(null);
                return;
            } else if (methodCount === 1) {
                const method = (
                    Object.keys(methods) as (keyof IAvailableAuthenticationMethods)[]
                ).find((method) => methods[method] === true)!;

                resolve(method);
                return;
            }

            setIsSelectingMethod(true);
            setAvailableMethods({
                authenticator: props.enableAuthenticator && methods.authenticator,
                webAuthn: props.enableWebAuthn && methods.webAuthn,
                emailMagicLink: props.enableEmailMagicLink && methods.emailMagicLink
            });

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

    const handleLogIn = async (event: Event) => {
        event.preventDefault();

        currentRequestAbortController?.abort();
        currentRequestAbortController = new AbortController();

        const abortSignal = currentRequestAbortController.signal;

        setActiveMethod(null);
        setStatus("waiting");
        setError(null);
        setDialogError(null);

        const username = usernameTextbox.value;

        if (username === "") {
            setError("Username is empty");

            return;
        }

        let availableMethods: IAvailableAuthenticationMethods;

        try {
            availableMethods = await client.getAvailableLogInMethodsAsync(username).catch();
        } catch (error: unknown) {
            if (abortSignal.aborted) {
                return;
            }

            if (!(error instanceof ApiError)) {
                throw error;
            }

            if (error.statusCode === 404) {
                setError("User not found.");
            } else {
                setError(error.message);
            }

            return;
        }

        if (abortSignal.aborted) {
            return;
        }

        const selectedMethod = await selectAuthenticationMethod(availableMethods);

        if (abortSignal.aborted) {
            return;
        }

        setActiveMethod(selectedMethod);

        switch (selectedMethod) {
            case "authenticator": {
                const result = await client.logInWithAuthenticatorNotificationAsync(
                    username,
                    {},
                    abortSignal
                );

                if (abortSignal.aborted) {
                    return;
                }

                setStatus(result.succeeded ? "success" : "error");

                if (!result.succeeded) {
                    const humanFailureReasons: { [reason in AuthenticationFailureReason]: string } =
                        {
                            timedOut: "Request timed out",
                            declined: "Request declined",
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
                const result = await client.logInWithWebAuthnAsync(username);

                if (abortSignal.aborted) {
                    return;
                }

                setStatus(result.succeeded ? "success" : "error");

                if (!result.succeeded) {
                    setDialogError("Authentication failed.");

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

                    currentRequestAbortController = null;

                    return;
                }

                try {
                    await client.sendLoginMagicLinkAsync(username, magicLinkRedirectUrl);
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

                if (abortSignal.aborted) {
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
        <form onSubmit={handleLogIn}>
            <input type="text" ref={usernameTextbox} />
            <Show when={error() !== null}>
                <p>{error()}</p>
            </Show>
            <button type="submit">Log In</button>

            <Switch>
                <Match when={activeMethod() === "authenticator"}>
                    <Dialog
                        title="We've sent a push message to your device(s)"
                        statusMessage={
                            status() === "waiting"
                                ? "Waiting for approval"
                                : status() === "success"
                                ? "Approved"
                                : dialogError() ?? "Failed"
                        }
                        statusType={status()}
                        alternateAction="Didn't get the push notification? Click here to scan a QR code instead"
                        onClose={handleCurrentRequestDismissed}
                    />
                </Match>
                <Match when={activeMethod() === "webAuthn"}>
                    <Dialog
                        title="We've sent an authentication request to your device"
                        statusMessage={
                            status() === "waiting"
                                ? "Waiting for authentication"
                                : status() === "success"
                                ? "Authenticated"
                                : dialogError() ?? "Failed"
                        }
                        statusType={status()}
                        onClose={handleCurrentRequestDismissed}
                    />
                </Match>
                <Match when={activeMethod() === "emailMagicLink"}>
                    <Dialog
                        title="We've sent you an email magic link to log you in"
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

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

        const selectedMethod = await selectAuthenticationMethod(availableMethods);

        setActiveMethod(selectedMethod);

        switch (selectedMethod) {
            case "authenticator": {
                const result = await client.logInWithAuthenticatorNotificationAsync(username);

                setStatus(result.succeeded ? "success" : "error");

                if (!result.succeeded) {
                    const humanFailureReasons: { [reason in AuthenticationFailureReason]: string } =
                        {
                            timedOut: "Request timed out",
                            declined: "Request declined",
                            unknown: "Unknown failure"
                        };

                    const failureReason = humanFailureReasons[result.failureReason];

                    setDialogError(failureReason);

                    return;
                }

                break;
            }

            case "webAuthn": {
                const result = await client.logInWithWebAuthnAsync(username);

                setStatus(result.succeeded ? "success" : "error");

                if (!result.succeeded) {
                    setDialogError("Authentication failed.");
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
                    await client.sendLoginMagicLinkAsync(username, magicLinkRedirectUrl);
                } catch (error: unknown) {
                    if (!(error instanceof ApiError)) {
                        throw error;
                    }

                    setStatus("error");
                    setDialogError(error.message);

                    return;
                }

                setStatus("success");

                break;
            }
        }
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

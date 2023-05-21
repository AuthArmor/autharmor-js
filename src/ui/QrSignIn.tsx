import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { useClient } from "./context/useClient";
import { AuthenticationResult, IAuthenticationSuccessResult, QrCodeResult } from "../client";
import { ApiError } from "../api";
import { QrCode } from "./common/QrCode";

export interface IQrSignInProps {
    onLogIn: (authenticationResult: IAuthenticationSuccessResult) => void;
}

export default function QrSignIn(props: IQrSignInProps) {
    const client = useClient();

    const abortController = new AbortController();

    const [signInUrl, setSignInUrl] = createSignal<string | null>(null);
    // const [remainingTimeSeconds, setRemainingTimeSeconds] = createSignal<number | null>(null);

    const [isLoading, setIsLoading] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    // let interval: unknown | null = null;

    // const ensureIntervalIsCleared = () => {
    //     if (interval !== null) {
    //         clearInterval(interval as any);
    //         interval = null;
    //     }
    // };

    const tryAuthentication = async () => {
        // ensureIntervalIsCleared();

        setIsLoading(true);
        setError(null);

        let qrResult: QrCodeResult<AuthenticationResult>;

        try {
            qrResult = await client.logInWithAuthenticatorQrCodeAsync({}, abortController.signal);
        } catch (error: unknown) {
            if (!(error instanceof ApiError)) {
                throw error;
            }

            setIsLoading(false);
            setError(error.message);

            return;
        }

        setSignInUrl(qrResult.qrCodeUrl);
        // setRemainingTimeSeconds(60);
        setIsLoading(false);

        // interval = setInterval(() => {
        //     setRemainingTimeSeconds((rts) => (rts === null ? null : rts - 1));
        // }, 1000);

        let authenticationResult: AuthenticationResult;

        try {
            authenticationResult = await qrResult.resultAsync();
        } catch (error: unknown) {
            if (!(error instanceof ApiError)) {
                throw error;
            }

            setSignInUrl(null);
            setError(error.message);

            return;
        }

        if (abortController.signal.aborted) {
            return;
        }

        // ensureIntervalIsCleared();

        setSignInUrl(null);
        // setRemainingTimeSeconds(null);

        if (authenticationResult.succeeded) {
            handleAuthenticationSuccess(authenticationResult);
        } else {
            switch (authenticationResult.failureReason) {
                case "timedOut": {
                    await tryAuthentication();
                    break;
                }

                case "declined": {
                    setError("Request declined!");
                    break;
                }

                case "unknown": {
                    setError("Unknown error!");
                    break;
                }
            }
        }
    };

    const handleAuthenticationSuccess = (authenticationResult: IAuthenticationSuccessResult) => {
        props.onLogIn(authenticationResult);
    };

    onMount(() => {
        tryAuthentication();
    });

    onCleanup(() => {
        // ensureIntervalIsCleared();

        abortController.abort();
    });

    // const remainingTimeSecondsComponent = () => (remainingTimeSeconds() ?? 0) % 60;
    // const remainingTimeMinutesComponent = () =>
    //     ((remainingTimeSeconds() ?? 0) - remainingTimeSecondsComponent()) / 60;

    return (
        <section>
            <div>
                <Show when={signInUrl() !== null}>
                    <QrCode data={signInUrl()!} />
                </Show>
                <Show when={isLoading()}>
                    <p>Loading...</p>
                </Show>
                <Show when={error() !== null}>
                    <div>
                        <p>{error()!}</p>
                        <button onClick={tryAuthentication}>Try Again</button>
                    </div>
                </Show>
            </div>
            <p>Scan this QR code using the app to sign in</p>
        </section>
    );
}

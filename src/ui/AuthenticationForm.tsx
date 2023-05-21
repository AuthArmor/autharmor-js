import { JSXElement, Match, Show, Switch, createSignal } from "solid-js";
import { IAuthenticationSuccessResult, IRegistrationSuccessResult } from "../client/models";
import { AuthArmorClient } from "../client/AuthArmorClient";
import { ClientProvider } from "./context/ClientProvider";
import { LogInForm } from "./LogInForm";
import QrSignIn from "./QrSignIn";
import { RegistrationForm } from "./RegistrationForm";

type AuthenticationMode = "logIn" | "register";

export interface IAuthenticationFormProps {
    client: AuthArmorClient;

    enableLogIn: boolean;
    enableRegistration: boolean;

    initialMode: AuthenticationMode;

    enableAuthenticator: boolean;
    enableEmailMagicLink: boolean;
    enableWebAuthn: boolean;

    logInMagicLinkRedirectUrl?: string;
    registrationMagicLinkRedirectUrl?: string;

    onLogIn: (authenticationResult: IAuthenticationSuccessResult) => void;
    onRegister: (registrationResult: IRegistrationSuccessResult) => void;
}

export function AuthenticationForm(props: IAuthenticationFormProps): JSXElement {
    const [authenticationMode, setAuthenticationMode] = createSignal<AuthenticationMode>(
        props.initialMode
    );

    const handleSwitchToLogIn = () => {
        setAuthenticationMode("logIn");
    }

    const handleSwitchToRegister = () => {
        setAuthenticationMode("register");
    };

    const handleLogIn = (authenticationResult: IAuthenticationSuccessResult) => {
        props.onLogIn?.(authenticationResult);
    };

    const handleRegister = (registrationResult: IRegistrationSuccessResult) => {
        props.onRegister?.(registrationResult);
    };

    return (
        <ClientProvider client={props.client}>
            <div>
                <nav>
                    <Show when={props.enableLogIn}>
                        <button onClick={handleSwitchToLogIn}>Login</button>
                    </Show>
                    <Show when={props.enableRegistration}>
                        <button onClick={handleSwitchToRegister}>Register</button>
                    </Show>
                </nav>
                <Switch>
                    <Match when={authenticationMode() === "logIn"}>
                        <Show when={props.enableAuthenticator}>
                            <div>
                                <p>Sign in using the Auth Armor Authenticator app</p>
                                <QrSignIn onLogIn={handleLogIn} />
                            </div>
                        </Show>
                        <div>
                            <p>Sign in with your username</p>
                            <LogInForm
                                enableAuthenticator={props.enableAuthenticator}
                                enableEmailMagicLink={props.enableEmailMagicLink}
                                enableWebAuthn={props.enableWebAuthn}
                                magicLinkRedirectUrl={props.logInMagicLinkRedirectUrl}
                                onLogIn={handleLogIn}
                            />
                        </div>
                    </Match>
                    <Match when={authenticationMode() === "register"}>
                        <div>
                            <p>Register with a username</p>
                            <RegistrationForm
                                enableAuthenticator={props.enableAuthenticator}
                                enableEmailMagicLink={props.enableEmailMagicLink}
                                enableWebAuthn={props.enableWebAuthn}
                                magicLinkRedirectUrl={props.registrationMagicLinkRedirectUrl}
                                onRegister={handleRegister}
                            />
                        </div>
                    </Match>
                </Switch>
            </div>
        </ClientProvider>
    );
}

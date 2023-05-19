import { JSXElement, Show } from "solid-js";
import { IAuthenticationSuccessResult, IRegistrationSuccessResult } from "../client/models";
import { AuthArmorClient } from "../client/AuthArmorClient";
import { ClientProvider } from "./context/ClientProvider";
import { LogInForm } from "./LogInForm";
import QrSignIn from "./QrSignIn";

export interface IAuthenticationFormProps {
    client: AuthArmorClient;

    enableLogIn: boolean;
    enableRegistration: boolean;

    enableAuthenticator: boolean;
    enableEmailMagicLink: boolean;
    enableWebAuthn: boolean;

    onLogIn: (authenticationResult: IAuthenticationSuccessResult) => void;
    onRegister: (registrationResult: IRegistrationSuccessResult) => void;
}

export function AuthenticationForm(props: IAuthenticationFormProps): JSXElement {
    const handleLogIn = (authenticationResult: IAuthenticationSuccessResult) => {
        props.onLogIn?.(authenticationResult);
    };

    return (
        <ClientProvider client={props.client}>
            <div>
                <nav>
                    <Show when={props.enableLogIn}>
                        <button>Login</button>
                    </Show>
                    <Show when={props.enableRegistration}>
                        <button>Register</button>
                    </Show>
                </nav>
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
                        onLogIn={handleLogIn}
                    />
                </div>
            </div>
        </ClientProvider>
    );
}

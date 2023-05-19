import { Portal, Show } from "solid-js/web";
import { IAvailableAuthenticationMethods } from "src/client";

export interface IAuthenticationMethodPickerProps {
    authenticationMethods: IAvailableAuthenticationMethods;

    onAuthenticationMethodSelected: (
        authenticationMethod: keyof IAvailableAuthenticationMethods
    ) => void;
    onDialogDismissed?: () => void;
}

export function AuthenticationMethodPicker(props: IAuthenticationMethodPickerProps) {
    const handleAuthenticatorPicked = () => {
        props.onAuthenticationMethodSelected("authenticator");
    };

    const handleWebAuthnPicked = () => {
        props.onAuthenticationMethodSelected("webAuthn");
    };

    const handleEmailMagicLinkPicked = () => {
        props.onAuthenticationMethodSelected("emailMagicLink");
    };

    return (
        <Portal>
            <div>
                <p>Please select your authentication method.</p>
                <div>
                    <Show when={props.authenticationMethods.authenticator}>
                        <button onClick={handleAuthenticatorPicked}>Authenticator App</button>
                    </Show>
                    <Show when={props.authenticationMethods.emailMagicLink}>
                        <button onClick={handleEmailMagicLinkPicked}>Email Magic Link</button>
                    </Show>
                    <Show when={props.authenticationMethods.webAuthn}>
                        <button onClick={handleWebAuthnPicked}>WebAuthn</button>
                    </Show>
                </div>
            </div>
        </Portal>
    );
}

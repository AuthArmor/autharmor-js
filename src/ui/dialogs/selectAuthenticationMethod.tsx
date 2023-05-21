import { render, Show } from "solid-js/web";
import { IAvailableAuthenticationMethods } from "../../client";
import { renderDialog } from "./renderDialog";
import { Dialog } from "./Dialog";

interface IAuthenticationMethodSelectionDialogProps {
    authenticationMethods: IAvailableAuthenticationMethods;

    onAuthenticationMethodSelect: (
        authenticationMethod: keyof IAvailableAuthenticationMethods
    ) => void;
    onDismiss?: () => void;
}

function AuthenticationMethodSelectionDialog(props: IAuthenticationMethodSelectionDialogProps) {
    const handleAuthenticatorPicked = () => {
        props.onAuthenticationMethodSelect("authenticator");
    };

    const handleWebAuthnPicked = () => {
        props.onAuthenticationMethodSelect("webAuthn");
    };

    const handleEmailMagicLinkPicked = () => {
        props.onAuthenticationMethodSelect("emailMagicLink");
    };

    const handleDismissed = () => {
        props.onDismiss?.();
    };

    return (
        <Dialog onDismiss={handleDismissed}>
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
        </Dialog>
    );
}

export async function selectAuthenticationMethod(
    authenticationMethods: IAvailableAuthenticationMethods,
    abortSignal?: AbortSignal
): Promise<keyof IAvailableAuthenticationMethods> {
    const authenticationMethod = await renderDialog<keyof IAvailableAuthenticationMethods>(
        (resolve, reject) => (
            <AuthenticationMethodSelectionDialog
                authenticationMethods={authenticationMethods}
                onAuthenticationMethodSelect={resolve}
                onDismiss={reject}
            />
        ),
        abortSignal
    );

    return authenticationMethod;
}

import { JSXElement } from "solid-js";

export interface IDialogProps {
    children: JSXElement;

    onDismiss?: () => void;
}

export function Dialog(props: IDialogProps) {
    const handleBackdropClicked = (event: { currentTarget: HTMLDivElement; target: Element }) => {
        // Ensure that the click is on the backdrop and not bubbling up from the dialog itself.
        if (event.target !== event.currentTarget) {
            return;
        }

        props.onDismiss?.();
    };

    return (
        <div onClick={handleBackdropClicked}>
            <div>{props.children}</div>
        </div>
    );
}

import { JSXElement } from "solid-js";
import { Portal, Show } from "solid-js/web";

export interface IDialogProps {
    title?: string;

    children?: JSXElement;

    statusMessage: string;
    statusType: DialogStatusType;

    alternateAction?: string;
    onAlternateActionClick?: () => void;

    onClose?: () => void;
}

export type DialogStatusType = "waiting" | "success" | "error";

export function Dialog(props: IDialogProps) {
    const handleClose = () => {
        props.onClose?.();
    }

    const handleAlternateActionClick = () => {
        props.onAlternateActionClick?.();
    };

    return (
        <Portal>
            <div>
                <Show when={props.onClose !== undefined}>
                    <button onClick={handleClose}>Close</button>
                </Show>

                <Show when={props.title !== undefined}>
                    <p>{props.title}</p>
                </Show>

                {props.children}

                <div>{props.statusMessage}</div>

                <Show when={props.onAlternateActionClick !== undefined}>
                    <button onClick={handleAlternateActionClick}>{props.alternateAction}</button>
                </Show>
            </div>
        </Portal>
    );
}

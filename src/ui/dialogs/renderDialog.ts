import { JSXElement } from "solid-js";
import { render } from "solid-js/web";
import { RequestDismissedError } from "../errors/RequestDismissedError";

export function renderDialog<T>(
    renderer: (resolve: (value: T) => void, dismiss: () => void) => JSXElement,
    abortSignal?: AbortSignal
): Promise<T> {
    return new Promise((resolve, reject) => {
        if (abortSignal?.aborted) {
            reject(abortSignal.reason);
            return;
        }

        const renderRoot = document.createElement("div");
        document.body.appendChild(renderRoot);

        const cleanup = () => {
            dispose();
            document.body.removeChild(renderRoot);
            abortSignal?.removeEventListener("abort", handleAborted);
        };

        const handleResolved = (value: T) => {
            cleanup();
            resolve(value);
        };
        
        const handleDismissed = () => {
            cleanup();
            reject(new RequestDismissedError());
        };

        const handleAborted = () => {
            cleanup();
            reject(abortSignal!.reason);
        };

        abortSignal?.addEventListener("abort", handleAborted);

        const dispose = render(() => renderer(handleResolved, handleDismissed), renderRoot);
    });
}

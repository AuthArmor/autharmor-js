import { JSXElement } from "solid-js";
import { render } from "solid-js/web";

export function renderDialog<T>(
    renderer: (resolve: (value: T) => void, reject: (reason?: any) => void) => JSXElement,
    abortSignal?: AbortSignal
): Promise<T> {
    return new Promise((resolve, reject) => {
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

        const handleRejected = (reason: any) => {
            cleanup();
            reject(reason);
        };

        const handleAborted = () => {
            cleanup();
            reject(abortSignal!.reason);
        };

        abortSignal?.addEventListener("abort", handleAborted);

        const dispose = render(() => renderer(handleResolved, handleRejected), renderRoot);
    });
}

import { IBase64Coder } from "./IBase64Coder";

/**
 * A base64 coder that uses the browser's built-in btoa and atob functions.
 */
export class BrowserBase64Coder implements IBase64Coder {
    /**
     * @inheritdoc
     */
    public encodeToBase64(input: string): string {
        return window.btoa(input);
    }

    /**
     * @inheritdoc
     */
    public decodeFromBase64(input: string): string {
        return window.atob(input);
    }

    /**
     * @inheritdoc
     */
    public tryDecodeFromBase64(input: string): string | null {
        try {
            return this.decodeFromBase64(input);
        } catch {
            return null;
        }
    }
}

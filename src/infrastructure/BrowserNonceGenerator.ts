import { INonceGenerator } from "./INonceGenerator";

/**
 * Generates a nonce using the browser's crypto API.
 */
export class BrowserNonceGenerator implements INonceGenerator {
    /**
     * Generates a nonce.
     * 
     * @returns The nonce.
     */
    generateNonce(): string {
        return window.crypto.randomUUID().replace("-", "");
    }
}

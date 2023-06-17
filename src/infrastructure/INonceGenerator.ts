export interface INonceGenerator {
    /**
     * Generates a nonce.
     *
     * @returns The nonce.
     */
    generateNonce: () => string;
}

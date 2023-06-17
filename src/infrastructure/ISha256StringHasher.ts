/**
 * Defines the interface for a SHA-256 string hasher.
 */
export interface ISha256StringHasher {
    /**
     * Hashes a string using SHA-256.
     *
     * @param stringInput The string to hash.
     * @returns The SHA-256 hash of the string as an ArrayBuffer.
     */
    hashStringToBuffer: (stringInput: string) => Promise<ArrayBuffer>;

    /**
     * Hashes a string using SHA-256.
     *
     * @param stringInput The string to hash.
     *
     * @returns The SHA-256 hash of the string as a hexadecimal string.
     */
    hashStringToHexString: (stringInput: string) => Promise<string>;

    /**
     * Generates an HMAC using SHA-256.
     *
     * @param secret The secret to use for the HMAC.
     * @param stringInput The string to hash.
     *
     * @returns The HMAC as a hexadecimal string.
     */
    generateHmac: (secret: ArrayBuffer, stringInput: string) => Promise<string>;
}

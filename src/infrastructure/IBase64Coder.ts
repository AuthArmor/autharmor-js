/**
 * Interface for Base64 encoding and decoding.
 */
export interface IBase64Coder {
    /**
     * Encodes a string to Base64.
     *
     * @param stringInput The string to encode.
     *
     * @returns The Base64-encoded string.
     */
    encodeToBase64: (stringInput: string) => string;

    /**
     * Decodes a string from Base64.
     *
     * @param base64Input The Base64 encoded string to decode.
     *
     * @returns The Base64-decoded string.
     *
     * @throws If the input is not a valid Base64 string.
     */
    decodeFromBase64: (base64Input: string) => string;

    /**
     * Attemps to decode a string from Base64.
     *
     * @param base64Input The Base64 encoded string to decode.
     *
     * @returns The Base64-decoded string, or null if the input is not a valid Base64 string.
     */
    tryDecodeFromBase64: (base64Input: string) => string | null;
}

import { ISha256StringHasher } from "./ISha256StringHasher";

/**
 * A class that implements the ISha256StringHasher interface using the browser crypto APIs.
 */
export class BrowserSha256StringHasher implements ISha256StringHasher {
    public constructor(private textEncoder: TextEncoder = new TextEncoder()) {}

    /**
     * @inheritdoc
     */
    public async hashStringToBuffer(stringInput: string): Promise<ArrayBuffer> {
        const data = this.textEncoder.encode(stringInput);
        const hash = await window.crypto.subtle.digest("SHA-256", data);

        return hash;
    }

    /**
     * @inheritdoc
     */
    public async hashStringToHexString(stringInput: string): Promise<string> {
        const hash = await this.hashStringToBuffer(stringInput);
        const hashArray = Array.from(new Uint8Array(hash));
        const hashHexString = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        return hashHexString;
    }

    /**
     * @inheritdoc
     */
    public async generateHmac(secret: ArrayBuffer, stringInput: string): Promise<string> {
        const data = this.textEncoder.encode(stringInput);
        const key = await window.crypto.subtle.importKey(
            "raw",
            secret,
            { name: "HMAC", hash: { name: "SHA-256" } },
            false,
            ["sign", "verify"]
        );
        const hash = await window.crypto.subtle.sign("HMAC", key, data);
        const hashArray = Array.from(new Uint8Array(hash));
        const hashHexString = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        return hashHexString;
    }
}

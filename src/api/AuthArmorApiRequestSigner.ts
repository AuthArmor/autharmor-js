import { BrowserBase64Coder } from "../infrastructure/BrowserBase64Coder";
import { IBase64Coder } from "../infrastructure/IBase64Coder";
import { ISha256StringHasher } from "../infrastructure/ISha256StringHasher";
import { ISystemClock } from "../infrastructure/ISystemClock";
import { NativeSystemClock } from "../infrastructure/NativeSystemClock";
import { BrowserSha256StringHasher } from "../infrastructure/BrowserSha256StringHasher";
import { INonceGenerator } from "../infrastructure/INonceGenerator";
import { BrowserNonceGenerator } from "../infrastructure/BrowserNonceGenerator";
import { IHostNameService } from "../infrastructure/IHostNameService";
import { BrowserHostNameService } from "../infrastructure/BrowserHostNameService";

/**
 * Implements the request signing logic for the AuthArmor API.
 */
export class AuthArmorApiRequestSigner {
    /**
     * The signing key used to sign requests to the AuthArmor API.
     */
    private readonly signingKey: string;

    /**
     * @param clientSdkApiKey The client SDK API key.
     * @param systemClock The system clock implementation.
     * @param nonceGenerator The nonce generator implementation.
     * @param base64Coder The base64 coder implementation.
     * @param sha256StringHasher The SHA256 string hasher implementation.
     */
    public constructor(
        clientSdkApiKey: string,
        private readonly systemClock: ISystemClock = new NativeSystemClock(),
        private readonly nonceGenerator: INonceGenerator = new BrowserNonceGenerator(),
        private readonly base64Coder: IBase64Coder = new BrowserBase64Coder(),
        private readonly sha256StringHasher: ISha256StringHasher = new BrowserSha256StringHasher(),
        private readonly hostNameService: IHostNameService = new BrowserHostNameService()
    ) {
        this.signingKey = this.getSigningKeyFromApiKey(clientSdkApiKey);
    }

    /**
     * Signs a request to the AuthArmor API.
     *
     * @param url The URL of the request.
     * @param body The body of the request.
     *
     * @returns The signature of the request.
     */
    public async signRequest(url: string, body: string): Promise<string> {
        const timestamp = this.systemClock.now().toISOString();
        const nonce = this.nonceGenerator.generateNonce();

        const urlObject = new URL(url);

        const path = urlObject.pathname.endsWith("/")
            ? urlObject.pathname.slice(0, -1)
            : urlObject.pathname;

        const host = this.hostNameService.getHostName();

        const signaturePayload = [this.signingKey, timestamp, path, host].join("|");

        const signatureHash = await this.sha256StringHasher.hashStringToBuffer(signaturePayload);
        const bodyHash = await this.sha256StringHasher.hashStringToHexString(body);

        const userAgent = navigator.userAgent.trim().toLowerCase();

        const message = [bodyHash, userAgent, timestamp, nonce].join("|");

        const signature = await this.sha256StringHasher.generateHmac(signatureHash, message);

        const signatureWithMetadata = [signature, timestamp, nonce].join("|");

        return signatureWithMetadata;
    }

    /**
     * Gets the request signing key from the API key JWT.
     *
     * @param apiKey The API key JWT.
     * @returns The signing key.
     */
    private getSigningKeyFromApiKey(apiKey: string): string {
        // The API key is a JWT (JSON Web Token) that contains the signing key in the payload.
        // We extract it from the 'key' property of the payload.

        const apiKeyJwtComponents = apiKey.split(".");

        if (apiKeyJwtComponents.length !== 3) {
            throw new Error("Invalid API key.");
        }

        const keyPayloadJsonBase64 = apiKeyJwtComponents[1];

        const keyPayloadJson = this.base64Coder.decodeFromBase64(keyPayloadJsonBase64);
        const keyPayload = JSON.parse(keyPayloadJson);
        const signingKey = keyPayload["key"];

        return signingKey;
    }
}

export class WebAuthnRequestDeniedError extends Error {
    public constructor() {
        super("Request denied.");
    }
}

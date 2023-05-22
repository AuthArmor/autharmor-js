export class RequestDismissedError extends Error {
    public constructor() {
        super("Request dismissed.");
    }
}

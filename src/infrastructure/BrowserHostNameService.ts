import { IHostNameService } from "./IHostNameService";

/**
 * A hostname service that uses the browser's current hostname.
 */
export class BrowserHostNameService implements IHostNameService {
    /**
     * @inheritdoc
     */
    public getHostName(): string {
        return window.location.hostname;
    }
}

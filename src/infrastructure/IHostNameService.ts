/**
 * Interface for retrieving the current hostname.
 */
export interface IHostNameService {
    /**
     * Gets the current hostname.
     *
     * @returns The current hostname.
     */
    getHostName: () => string;
}

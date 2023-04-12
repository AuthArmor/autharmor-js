/**
 * Interface for the ReCaptcha service.
 */
export interface IReCaptchaService {
    /**
     * Executes the ReCaptcha action.
     * 
     * @param action The action to execute.
     * 
     * @returns The token.
     */
    executeAsync(action: string): Promise<string>;
}

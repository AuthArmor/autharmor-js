import { IReCaptchaService } from "./IReCaptchaService";

/**
 * Blank implementation of the ReCaptcha service that returns empty tokens.
 */
export class BlankReCaptchaService implements IReCaptchaService {
    /**
     * @inheritdoc
     */
    executeAsync(): Promise<string> {
        return Promise.resolve("");
    }
}

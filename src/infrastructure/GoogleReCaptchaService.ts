import { IReCaptchaService } from "./IReCaptchaService";

/**
 * Implementation of the ReCaptcha service using Google's ReCaptcha.
 */
export class GoogleReCaptchaService implements IReCaptchaService {
    /**
     * @param reCaptchaSiteKey The ReCaptcha site key.
     */
    public constructor(private reCaptchaSiteKey: string) {}

    /**
     * Initializes the ReCaptcha service.
     * 
     * @returns A promise that resolves when the service is initialized.
     */
    public async initializeAsync(): Promise<void> {
        const script = document.createElement("script");
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(
            this.reCaptchaSiteKey
        )}`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        return new Promise<void>((resolve, reject) => {
            script.onload = () => grecaptcha.ready(() => resolve());
            script.onerror = () => reject();
        });
    }

    /**
     * @inheritdoc
     */
    public async executeAsync(action: string): Promise<string> {
        return grecaptcha.execute(this.reCaptchaSiteKey, { action });
    }
}

declare const grecaptcha: {
    ready(callback: () => void): void;
    execute(siteKey: string, options: { action: string }): Promise<string>;
};

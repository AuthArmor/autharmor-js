export interface QrCodeResult<TResult> {
    qrCodeUrl: string;
    verificationCode: string | null;
    resultAsync: () => Promise<TResult>;
}

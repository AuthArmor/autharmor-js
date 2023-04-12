export interface QrCodeResult<TResult> {
    qrCodeUrl: string;
    resultAsync: () => Promise<TResult>;
}

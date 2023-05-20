import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { QRCodeToDataURLOptions, toDataURL } from "qrcode";

const qrCodeOptions: QRCodeToDataURLOptions = {
    margin: 1,
    color: {
        light: "#202020FF",
        dark: "#2CB2B5FF"
    }
};

export interface IQrCodeProps {
    data: string;
}

export function QrCode(props: IQrCodeProps) {
    const [qrDataUrl, setQrDataUrl] = createSignal<string>();

    createEffect(on(() => props.data, async () => {
        let isCanceled = false;
        onCleanup(() => isCanceled = true);

        const dataUrl = await toDataURL(props.data, qrCodeOptions);

        if (!isCanceled) {
            setQrDataUrl(dataUrl);
        }
    }));

    return <img src={qrDataUrl()} alt="QR Code" />
}

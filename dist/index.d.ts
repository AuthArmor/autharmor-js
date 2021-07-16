declare type Events = "authenticating" | "authenticated" | "inviteWindowOpened" | "inviteWindowClosed" | "popupOverlayOpened" | "popupOverlayClosed" | "inviteAccepted" | "inviteDeclined" | "inviteExists" | "inviteCancelled" | "error";
declare type EventListener = (...data: any) => void | Promise<void>;
interface InviteOptions {
    nickname: string;
    referenceId?: string;
}
interface InviteData {
    inviteCode: string;
    signature: string;
}
interface AuthRequest {
    authRequest: {
        auth_request_id: string;
        auth_profile_id: string;
        visual_verify_value: string;
        response_code: number;
        response_message: string;
        qr_code_data: string;
        push_message_sent: boolean;
    };
    requestToken: string;
}
interface AuthenticateWebsocketSuccess {
    data: {
        response: any;
        nickname: string;
        token: string;
        authorized: true;
    };
    metadata: any;
}
interface AuthenticateWebsocketFail {
    data: {
        response: any;
        nickname: string;
        authorized: false;
    };
    metadata: any;
}
interface AuthenticateArgs {
    nickname: string;
    sendPush: boolean;
    visualVerify: boolean;
    showPopup: boolean;
    qrCodeStyle: {
        borderRadius: number;
        background: string;
        foreground: string;
    };
    onSuccess: (data: AuthenticateWebsocketSuccess) => any;
    onFailure: (data: AuthenticateWebsocketFail) => any;
}
declare global {
    interface Window {
        AuthArmorSDK: any;
        AuthArmor: any;
    }
}
declare class SDK {
    private url;
    private events;
    private eventListeners;
    private socket;
    private requestCompleted;
    constructor({ url, pathPrefix, polling }: {
        url?: string | undefined;
        pathPrefix?: string | undefined;
        polling?: boolean | undefined;
    });
    private processUrl;
    private ensureEventExists;
    private popupWindow;
    private showPopup;
    private hidePopup;
    private updateMessage;
    private executeEvent;
    private init;
    on(eventName: Events, fn: EventListener): void;
    off(eventName: Events): void;
    private setInviteData;
    private generateInviteCode;
    private confirmInvite;
    private logout;
    private authenticate;
    private getUser;
    get invite(): {
        generateInviteCode: ({ nickname, referenceId }: InviteOptions) => Promise<any>;
        setInviteData: ({ inviteCode, signature }: InviteData) => {
            getQRCode: ({ backgroundColor, fillColor, borderRadius }?: {
                backgroundColor?: string | undefined;
                fillColor?: string | undefined;
                borderRadius?: number | undefined;
            }) => any;
            getInviteLink: () => string;
            openInviteLink: () => void;
        };
        confirmInvite: (nickname: string) => Promise<any>;
    };
    get auth(): {
        authenticate: ({ nickname, sendPush, visualVerify, showPopup, qrCodeStyle, onSuccess, onFailure }: AuthenticateArgs) => Promise<AuthRequest>;
        getUser: () => Promise<any>;
        logout: () => Promise<any>;
    };
    get popup(): {
        show: (message?: string, hideQRBtn?: boolean | undefined) => void;
        hide: (delay?: number) => void;
        updateMessage: (message: string, status?: string) => void;
    };
}
export default SDK;

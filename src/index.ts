import Axios, { Response } from "redaxios";
import kjua from "kjua";
import generateColor from "string-to-color";
import styles from "./css/index.module.css";
import config from "./config/index";
import qrCode from "./assets/qr-code.svg";
import logo from "./assets/logo.png";
import closeIcon from "./assets/cancel.svg";
import refreshIcon from "./assets/refresh.svg";
import phoneIcon from "./assets/phone.svg";
import emailIcon from "./assets/email.svg";
import WebAuthnSDK from "autharmor-webauthn-sdk";

type Events =
  | "authenticating"
  | "authenticated"
  | "inviteWindowOpened"
  | "inviteWindowClosed"
  | "popupOverlayOpened"
  | "popupOverlayClosed"
  | "inviteAccepted"
  | "inviteDeclined"
  | "inviteExists"
  | "inviteCancelled"
  | "registerSuccess"
  | "error";

type AuthTypes = "magiclink" | "push" | "usernameless" | "webauthn";

type AuthMethods = "authenticator" | "magiclink" | "webauthn";

type EventListener = (...data: any) => void | Promise<void>;

interface InviteNicknameOptions {
  nickname: string;
  headers?: Record<string, string>;
}

interface InviteIdOptions {
  id: string;
  headers?: Record<string, string>;
}

interface InviteOptions {
  nickname: string;
  referenceId?: string;
  reset?: boolean;
  headers?: Record<string, string>;
}

interface InviteData {
  inviteCode: string;
  signature: string;
}

interface AuthRequest {
  auth_request_id: string;
  auth_profile_id: string;
  visual_verify_value: string;
  response_code: number;
  response_message: string;
  qr_code_data: string;
  push_message_sent: boolean;
  timeout_in_seconds: number;
  timeout_utc_datetime: string;
}

type AuthenticateResponse =
  | AuthenticateResponseSuccess
  | AuthenticateResponseFail;

interface AuthenticateResponseSuccess {
  response: any;
  nickname: string;
  token: string;
  authorized: true;
  status: "Success" | "timeout" | "Declined";
  /* Custom response received from auth server */
  metadata?: any;
}

interface AuthenticateResponseFail {
  response: any;
  nickname: string;
  authorized: false;
  status: "Success" | "timeout" | "Declined";
  /* Custom response received from auth server */
  metadata?: any;
}

interface LocationData {
  latitude: string;
  longitude: string;
}

interface AuthenticateArgs {
  nickname: string;
  sendPush: boolean;
  actionName: string;
  shortMessage: string;
  visualVerify: boolean;
  showPopup: boolean;
  headers?: Record<string, string>;
  qrCodeStyle: {
    borderRadius: number;
    background: string;
    foreground: string;
  };
  locationData: LocationData;
  onSuccess: (data: AuthenticateResponseSuccess) => any;
  onFailure: (data: AuthenticateResponseFail) => any;
}

interface FormStyles {
  accentColor: string;
  backgroundColor: string;
  tabColor: string;
  activeTabColor: string;
  qrCodeBackground: string;
}

interface FormMountOptions {
  methods?: AuthMethods[];
  usernameless?: boolean;
  styles?: Partial<FormStyles>;
}

const defaultOptions: FormMountOptions = {
  methods: ["authenticator", "magiclink", "webauthn"],
  usernameless: true,
  styles: {
    accentColor: "#0bdbdb",
    backgroundColor: "#2a2d35",
    activeTabColor: "#363a46",
    tabColor: "#363a46",
    qrCodeBackground: "#202020"
  }
};

interface OnAuthResponse {
  authResponse: AuthenticateResponse;
  redirectedUrl?: string;
  onSuccess: (data: AuthenticateResponseSuccess) => any;
  onFailure: (data: AuthenticateResponseFail) => any;
}

interface PollAuthRequest {
  id: string;
  headers?: Record<string, string>;
  onSuccess: (data: AuthenticateResponseSuccess) => any;
  onFailure: (data: AuthenticateResponseFail) => any;
}

interface DebugSettings {
  url: string;
}

declare global {
  interface Window {
    AuthArmorSDK: any;
    AuthArmor: any;
  }

  interface Crypto {
    randomUUID: () => string;
  }
}

const $ = (selectors: string) => document.querySelector(selectors);

const isMobile = () => {
  const toMatch = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i
  ];

  return toMatch.some(toMatchItem => {
    return navigator.userAgent.match(toMatchItem);
  });
};

class SDK {
  private url: string;
  private publicKey?: string;
  private webauthnClientId?: string;
  private webauthn?: WebAuthnSDK;
  private events: Events[];
  private eventListeners: Map<Events, EventListener[]>;
  private tickTimerId?: NodeJS.Timeout;
  private requestCompleted = false;
  private pollInterval = 500;
  private expirationDate = Date.now();
  private pollTimerId?: NodeJS.Timeout;
  private QRAnimationTimer?: NodeJS.Timeout;
  private hasCalledValidate = false;
  private registerRedirectUrl?: string;
  private authenticationRedirectUrl?: string;
  private debug: DebugSettings = {
    url: "https://auth.autharmor.dev"
  };

  constructor({
    endpointBasePath = "",
    publicKey = "",
    webauthnClientId = "",
    registerRedirectUrl = "",
    authenticationRedirectUrl = "",
    debug = { url: "https://auth.autharmor.dev" }
  }) {
    this.url = this.processUrl(endpointBasePath);

    if (registerRedirectUrl) {
      this.registerRedirectUrl = registerRedirectUrl;
    }

    if (authenticationRedirectUrl) {
      this.authenticationRedirectUrl = authenticationRedirectUrl;
    }

    if (!publicKey) {
      throw new Error("Please specify a valid public key!");
    }

    console.log(debug);

    if (debug) {
      this.debug = debug;
    }

    this.publicKey = publicKey;
    this.webauthnClientId = webauthnClientId;
    if (webauthnClientId) {
      this.webauthn = new WebAuthnSDK({
        webauthnClientId
      });
    }
    Axios.defaults.baseURL = this.url;

    // Supported events
    this.events = [
      "authenticating",
      "authenticated",
      "inviteWindowOpened",
      "inviteWindowClosed",
      "popupOverlayOpened",
      "popupOverlayClosed",
      "inviteAccepted",
      "inviteDeclined",
      "inviteExists",
      "inviteCancelled",
      "registerSuccess",
      "error"
    ];
    this.eventListeners = new Map<Events, EventListener[]>(
      (Object.entries(
        this.events.reduce((eventListeners, eventName) => {
          const listeners: EventListener[] = [];
          return {
            ...eventListeners,
            [eventName as Events]: listeners
          };
        }, {})
      ) as unknown) as Iterable<readonly [Events, EventListener[]]>
    );

    window.AuthArmor = {};
    this.init = this.init.bind(this);
    this.init();
  }

  // Private Methods

  private processUrl = (url = "") => {
    const lastCharacter = url.slice(-1);
    const containsSlash = lastCharacter === "/";
    if (containsSlash) {
      return url.slice(0, -1);
    }

    return url;
  };

  private ensureEventExists = (eventName: Events) => {
    if (!this.events.includes(eventName)) {
      throw new Error("Event doesn't exist");
    }
  };

  private popupWindow = (
    url: string,
    title: string,
    width: number,
    height: number
  ) => {
    const x = window.outerWidth / 2 + window.screenX - width / 2;
    const y = window.outerHeight / 2 + window.screenY - height / 2;
    const openedWindow = window.open(
      url,
      title,
      `toolbar=no, 
      location=no, 
      directories=no, 
      status=no, 
      menubar=no, 
      scrollbars=no, 
      resizable=no, 
      copyhistory=no, 
      width=${width}, 
      height=${height}, 
      left=${x},
      top=${y}`
    );
    this.executeEvent("inviteWindowOpened");
    const interval = setInterval(function() {
      if (!openedWindow || openedWindow.closed) {
        clearInterval(interval);
        window.AuthArmor.closedWindow();
      }
    }, 500);
  };

  private showPopup = (message = "Waiting for device", hideQRBtn?: boolean) => {
    const popupOverlay = document.querySelector(`.${styles.popupOverlay}`);
    const showQRCodeBtn = document.querySelector(
      `.${styles.showPopupQrcodeBtn}`
    );
    const hideQRCodeBtn = document.querySelector(
      `.${styles.hidePopupQrcodeBtn}`
    );

    if (hideQRBtn) {
      showQRCodeBtn?.classList.add(styles.hidden);
      hideQRCodeBtn?.classList.add(styles.hidden);
    }

    if (!hideQRBtn) {
      showQRCodeBtn?.classList.remove(styles.hidden);
      hideQRCodeBtn?.classList.add(styles.hidden);
    }

    if (popupOverlay) {
      popupOverlay.classList.remove(styles.hidden);
    }

    if (message) {
      this.updateMessage(message, "success");
    }

    this.executeEvent("popupOverlayOpened");
  };

  private hidePopup = (delay = 2000) => {
    setTimeout(() => {
      const authMessage = document.querySelector(`.${styles.authMessage}`);
      const authMessageText = document.querySelector(
        `.${styles.authMessageText}`
      );
      const popupOverlay = document.querySelector(`.${styles.popupOverlay}`);
      const visualVerifyElement = $(
        `.${styles.visualVerifyIcon}`
      ) as HTMLDivElement;
      const authArmorIcon = $(`.${styles.autharmorIcon}`) as HTMLImageElement;

      if (popupOverlay) {
        popupOverlay.classList.add(styles.hidden);
      }

      if (visualVerifyElement) {
        visualVerifyElement.classList.add(styles.hidden);
        visualVerifyElement.textContent = "";
      }

      if (authMessage) {
        authMessage.setAttribute("class", styles.authMessage);
        this.executeEvent("popupOverlayClosed");
        setTimeout(() => {
          if (authMessageText) {
            authMessageText.textContent = "Waiting for device";
          }

          if (authArmorIcon) {
            authArmorIcon.src = logo;
          }

          document
            .querySelector(`.${styles.authNotice}`)
            ?.classList.add(styles.hidden);
        }, 200);
      }
    }, delay);
  };

  private updateMessage = (message: string, status = "success") => {
    const authMessage = document.querySelector(`.${styles.authMessage}`);
    const authMessageText = document.querySelector(
      `.${styles.authMessageText}`
    );
    if (authMessage && authMessageText) {
      authMessage.classList.add(styles[`autharmor--${status}`]);
      authMessageText.textContent = message;
    }
  };

  private executeEvent = (eventName: Events, ...data: unknown[]) => {
    this.ensureEventExists(eventName);

    const listeners = this.eventListeners.get(eventName);
    listeners?.map(listener => listener(...data));
  };

  private showPopupQRCode = () => {
    const showPopupQrBtn = $(`.${styles.showPopupQrcodeBtn}`);
    const hidePopupQrBtn = $(`.${styles.hidePopupQrcodeBtn}`);
    const authMessage = $(`.${styles.authMessage}`);
    const qrCodeContainer = $(`.${styles.qrCodeImgContainer}`);
    const autharmorIcon = $(`.${styles.autharmorIcon}`);
    const pushNotice = $(`.${styles.pushNotice}`);

    if (this.QRAnimationTimer) {
      clearTimeout(this.QRAnimationTimer);
    }

    showPopupQrBtn?.classList.add(styles.hidden);
    autharmorIcon?.classList.add(styles.hidden);
    this.QRAnimationTimer = setTimeout(() => {
      qrCodeContainer?.classList.remove(styles.hidden);
      hidePopupQrBtn?.classList.remove(styles.hidden);
      authMessage?.classList.add(styles.rounded);
      pushNotice?.classList.add(styles.hidden);
    }, 200);
  };

  private hidePopupQRCode = () => {
    const showPopupQrBtn = $(`.${styles.showPopupQrcodeBtn}`);
    const hidePopupQrBtn = $(`.${styles.hidePopupQrcodeBtn}`);
    const authMessage = $(`.${styles.authMessage}`);
    const qrCodeContainer = $(`.${styles.qrCodeImgContainer}`);
    const autharmorIcon = $(`.${styles.autharmorIcon}`);
    const pushNotice = $(`.${styles.pushNotice}`);

    if (this.QRAnimationTimer) {
      clearTimeout(this.QRAnimationTimer);
    }

    hidePopupQrBtn?.classList.add(styles.hidden);
    qrCodeContainer?.classList.add(styles.hidden);
    this.QRAnimationTimer = setTimeout(() => {
      autharmorIcon?.classList.remove(styles.hidden);
      showPopupQrBtn?.classList.remove(styles.hidden);
      authMessage?.classList.remove(styles.rounded);
      pushNotice?.classList.remove(styles.hidden);
    }, 200);
  };

  private init() {
    document.body.innerHTML += `
      <div class="${styles.popupOverlay} ${styles.hidden}">
        <div class="${styles.popupOverlayContent}">
          <div class="${styles.popupContentContainer}">
            <div class="${styles.closePopupBtn}">
              <img src="${closeIcon}" alt="Close Popup Button" />
            </div>
            <div class="${styles.hidePopupQrcodeBtn} ${styles.hidden}">
              <img src="${qrCode}" alt="QR Code Button" />
              <p class="${styles.popupQrcodeBtnText}">Hide QR Code</p>
            </div>
            <div class="${styles.visualVerifyIcon} ${styles.hidden}"></div>
            <p class="${styles.pushNotice}">We've sent a push message to your device(s)</p>
            <img src="${logo}" alt="AuthArmor Icon" class="${styles.autharmorIcon}" />
            <div class="${styles.qrCodeImgContainer} ${styles.hidden}">
              <img src="" alt="QR Code" class="${styles.qrCodeImg}" />
              <p class="${styles.qrCodeImgDesc}">Please scan the code with the AuthArmor app</p>
            </div>
          </div>
          <div class="${styles.authNotice} ${styles.hidden}">This dialog will close once you have successfully paired the app</div>
          <div class="${styles.authMessage}"><span class="${styles.authMessageText}">Authenticating with AuthArmor...</span><span class="${styles.pulse}"></span></div>
          <div class="${styles.showPopupQrcodeBtn}">
            <p class="${styles.qrcodeBtnText}">Didn't get the push notification? Click here to scan a QR code instead</p>
          </div>
        </div>
      </div>
    `;

    const popup = $(`.${styles.popupOverlay}`);
    const showPopupQrBtn = $(`.${styles.showPopupQrcodeBtn}`);
    const hidePopupQrBtn = $(`.${styles.hidePopupQrcodeBtn}`);
    const qrCodeContainer = $(`.${styles.qrCodeImgContainer}`);
    const autharmorIcon = $(`.${styles.autharmorIcon}`);
    const closePopupBtn = $(`.${styles.closePopupBtn}`);
    let timer: NodeJS.Timeout;

    showPopupQrBtn?.addEventListener("click", this.showPopupQRCode);

    hidePopupQrBtn?.addEventListener("click", this.hidePopupQRCode);

    closePopupBtn?.addEventListener("click", () => {
      clearTimeout(timer);
      popup?.classList.add(styles.hidden);
      hidePopupQrBtn?.classList.add(styles.hidden);
      qrCodeContainer?.classList.add(styles.hidden);
      autharmorIcon?.classList.remove(styles.hidden);
      showPopupQrBtn?.classList.remove(styles.hidden);
      document
        .querySelector(`.${styles.loadingOverlay}`)
        ?.classList.add(styles.hidden);

      const visualVerifyElement = $(
        `.${styles.visualVerifyIcon}`
      ) as HTMLDivElement;

      if (visualVerifyElement) {
        visualVerifyElement.classList.add(styles.hidden);
        visualVerifyElement.textContent = "";
      }
    });

    window.AuthArmor.openedWindow = () => {
      this.executeEvent("inviteWindowOpened");
      this.showPopup();
      this.requestCompleted = false;
    };

    window.addEventListener("message", message => {
      try {
        if (message.origin === config.inviteURL) {
          return;
        }

        const parsedMessage = JSON.parse(message.data);

        if (parsedMessage.type === "requestAccepted") {
          this.executeEvent("inviteAccepted", parsedMessage);
          this.updateMessage(parsedMessage.data.message);
          this.requestCompleted = true;
          this.hidePopup();
        }

        if (parsedMessage.type === "requestCancelled") {
          this.executeEvent("inviteCancelled", parsedMessage);
          this.updateMessage(parsedMessage.data.message, "danger");
          this.requestCompleted = true;
          this.hidePopup();
        }

        if (parsedMessage.type === "requestError") {
          this.executeEvent("error", parsedMessage);
          this.updateMessage(parsedMessage.data.message, "danger");
          this.requestCompleted = true;
          this.hidePopup();
        }

        if (parsedMessage.type === "requestExists") {
          this.executeEvent("inviteExists", parsedMessage);
          this.updateMessage(parsedMessage.data.message, "warn");
          this.requestCompleted = true;
          this.hidePopup();
        }
      } catch (err) {}
    });

    window.AuthArmor.closedWindow = () => {
      this.executeEvent("inviteWindowClosed");

      if (!this.requestCompleted) {
        this.updateMessage("User closed the popup", "danger");
      }

      this.hidePopup();
    };
  }

  private updateModalText = (tabName: "register" | "login" = "login") => {
    const text = {
      register: {
        push: {
          title: "Mobile Phone Biometrics",
          desc: "Link your phone for fast logins and great security"
        },
        magiclink: {
          title: "MagicLink Email",
          desc: "Send me a magic link email to register"
        },
        webauthn: {
          title: "WebAuthN",
          desc: "Register using your local device or security key"
        }
      },
      login: {
        push: {
          title: "Push Message",
          desc: "Send me a push message to my Auth Armor Authenticator"
        },
        magiclink: {
          title: "MagicLink Email",
          desc: "Send me a magic link email"
        },
        webauthn: {
          title: "WebAuthN",
          desc: "Authenticate using my local device or security key"
        }
      }
    };

    const currentText = text[tabName];

    if (document.querySelector(`[data-card='push']`)) {
      document.querySelector(
        `[data-card='push'] .${styles.title}`
      )!.textContent = currentText.push.title;
      document.querySelector(
        `[data-card='push'] .${styles.text}`
      )!.textContent = currentText.push.desc;
    }

    if (document.querySelector(`[data-card='magiclink']`)) {
      document.querySelector(
        `[data-card='magiclink'] .${styles.title}`
      )!.textContent = currentText.magiclink.title;
      document.querySelector(
        `[data-card='magiclink'] .${styles.text}`
      )!.textContent = currentText.magiclink.desc;
    }

    if (document.querySelector(`[data-card='webauthn']`)) {
      document.querySelector(
        `[data-card='webauthn'] .${styles.title}`
      )!.textContent = currentText.webauthn.title;
      document.querySelector(
        `[data-card='webauthn'] .${styles.text}`
      )!.textContent = currentText.webauthn.desc;
    }
  };

  private selectTab = (
    event: MouseEvent,
    tabName: "register" | "login"
  ): void => {
    const tabContent = document.getElementsByClassName(
      styles.tabContent
    ) as HTMLCollectionOf<HTMLDivElement>;
    for (let i = 0; i < tabContent.length; i++) {
      tabContent[i].style.display = "none";
    }

    const tabs = document.getElementsByClassName(
      styles.tab
    ) as HTMLCollectionOf<HTMLDivElement>;
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove(styles.activeTab);
    }

    const tab = document.getElementById(tabName);

    if (tab) {
      tab.style.display = "block";
    }

    if (event.target) {
      const target = event.target as HTMLDivElement;
      target.classList.add(styles.activeTab);
    }

    this.updateModalText(tabName);
  };

  private closeModal = () => {
    const modal = document.querySelector(`.${styles.modal}`);
    const authNotice = document.querySelector(`.${styles.authNotice}`);

    if (modal) {
      modal.classList.add(styles.hidden);
    }

    if (authNotice) {
      authNotice.classList.add(styles.hidden);
    }
  };

  private padTime = (seconds: number) => {
    if (seconds < 10) {
      return "0" + seconds;
    }

    return seconds;
  };

  private tickTimer = () => {
    const timeLeft = this.expirationDate - Date.now();
    const timeLeftDate = new Date(timeLeft);
    const timer = document.querySelector(`.${styles.timer}`);

    if (timeLeft <= 0 && timer) {
      timer.textContent = "00:00";
      return null;
    }

    const minutes = timeLeftDate.getMinutes();
    const seconds = timeLeftDate.getSeconds();

    if (timer) {
      timer.textContent = `${this.padTime(minutes)}:${this.padTime(seconds)}`;
    }

    this.tickTimerId = setTimeout(() => {
      this.tickTimer();
    }, 1000);
  };

  private bytesToHex = (hash: ArrayBuffer) =>
    Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

  private sha256 = async (message: string) => {
    // encode as UTF-8
    const msgBuffer = new TextEncoder().encode(message);

    // hash the message
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

    // convert bytes to hex string
    const hashHex = this.bytesToHex(hashBuffer);

    return { hashBuffer, hashHex };
  };

  private hmac = async (secret: ArrayBuffer, message: string) => {
    const encoder = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      "raw", // raw format of the key - should be Uint8Array
      new Uint8Array(secret),
      {
        // algorithm details
        name: "HMAC",
        hash: { name: "SHA-256" }
      },
      false, // export = false
      ["sign", "verify"] // what this key can do
    );
    const signature = await window.crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(message)
    );
    const b = new Uint8Array(signature);
    const str = Array.prototype.map
      .call(b, x => x.toString(16).padStart(2, "0"))
      .join("");

    return str;
  };

  private getRequestSignature = async (url: string, body = "") => {
    const timestamp = new Date().toISOString();
    const nonce = crypto?.randomUUID().replace(/-/g, "");

    const urlParser = document.createElement("a");
    urlParser.href = url;

    const [, keyPayloadBase64] = this.publicKey?.split(".") ?? [];
    const keyPayload = JSON.parse(atob(keyPayloadBase64));
    const requestPath = urlParser.pathname.replace(/\/$/gi, "");
    const host = location.hostname;
    const signature = [keyPayload.key, timestamp, requestPath, host].join("|");
    const { hashBuffer: signatureBuffer } = await this.sha256(signature);

    const { hashHex: hashedBody } = await this.sha256(body);
    const userAgent = navigator.userAgent.trim().toLowerCase();
    const message = [hashedBody, userAgent, timestamp, nonce].join("|");

    const finalSignature = await this.hmac(signatureBuffer, message);
    return [finalSignature, timestamp, nonce].join("|");
  };

  private fetch = async (url: string, options: any = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        "X-AuthArmor-ClientMsgSigv1": await this.getRequestSignature(
          url,
          options.body
        )
      }
    });
  };

  private getEnrollmentStatus = async ({
    id = "",
    expirationDate = Date.now(),
    pollDuration = 2000
  } = {}): Promise<void> => {
    const body = await this.fetch(
      `${this.debug.url}/api/v3/users/${id}/autharmorauthenticatorenrollmentstatus?apikey=${this.publicKey}`,
      {
        method: "POST"
      }
    ).then(response => response.json());

    if (
      body.enrollment_status === "not_enrolled_or_not_found" &&
      expirationDate <= Date.now()
    ) {
      console.log("Invite Expired...");
      document
        .querySelector(`.${styles.qrCodeTimeout}`)
        ?.classList.remove(styles.hidden);
      document
        .querySelector(`.${styles.mobileUsernameless}`)
        ?.classList.add(styles.hidden);
      this.hasCalledValidate = false;
      this.executeEvent("error", body);
      return;
    }

    if (
      pollDuration &&
      body.enrollment_status === "not_enrolled_or_not_found"
    ) {
      console.log("Polling Invite...");
      this.pollTimerId = setTimeout(() => {
        this.hasCalledValidate = false;
        this.getEnrollmentStatus({ id, pollDuration, expirationDate });
      }, pollDuration);
      return;
    }

    console.log(
      body,
      body?.auth_response_message === "timeout",
      this.hasCalledValidate
    );

    if (
      body.enrollment_status !== "not_enrolled_or_not_found" &&
      !this.hasCalledValidate
    ) {
      this.hasCalledValidate = true;
      // TODO: Do something on success
      this.executeEvent("registerSuccess", {
        ...body,
        auth_method: "AuthArmorAuthenticator",
        id
      });
      this.updateMessage("Registered successfully!", "success");
      this.hidePopup(2000);
    }

    if (this.pollTimerId) {
      clearTimeout(this.pollTimerId);
    }
  };

  private getRequestStatus = async ({
    id = "",
    pollDuration = 2000,
    usernameless = false
  } = {}): Promise<void> => {
    const body = await this.fetch(
      `${this.debug.url}/api/v3/auth/request/status/${id}?apikey=${this.publicKey}`,
      {
        method: "GET"
      }
    )
      .then(response => response.json())
      .catch(err => console.error(err));

    if (
      pollDuration &&
      (!body?.auth_response_message ||
        body?.auth_request_status_name === "pending_approval")
    ) {
      this.pollTimerId = setTimeout(() => {
        this.hasCalledValidate = false;
        this.getRequestStatus({ id, pollDuration, usernameless });
      }, pollDuration);
      return;
    }

    if (
      body?.auth_request_status_name === "pending_validation" &&
      body?.auth_response_message !== "Timeout" &&
      !this.hasCalledValidate &&
      !usernameless
    ) {
      // TODO: Do something on success
      this.hasCalledValidate = true;
      this.executeEvent("authenticated", { ...body, id });
      this.updateMessage("Authenticated successfully!", "success");
      this.hidePopup(2000);
    }

    if (body?.auth_response_message === "Timeout" && !this.hasCalledValidate) {
      document
        .querySelector(`.${styles.qrCodeTimeout}`)!
        .classList.remove(styles.hidden);
      document
        .querySelector(`.${styles.mobileUsernameless}`)
        ?.classList.add(styles.hidden);
      this.hasCalledValidate = false;
    }

    if (this.pollTimerId) {
      clearTimeout(this.pollTimerId);
    }
  };

  registerAuthenticator = async (username: string) => {
    const timeoutSeconds = 120;
    // TODO: Customize auth payload
    const payload = {
      action_name: "Login",
      username,
      short_msg: "Login pending - please authorize",
      timeout_in_seconds: timeoutSeconds,
      origin_location_data: { latitude: "34.05349", longitude: "-118.24532" },
      registration_redirect_url: "http://localhost:3000/magic-register"
    };

    document
      .querySelector(`.${styles.authNotice}`)
      ?.classList.remove(styles.hidden);
    this.showPopup("Loading QR Code...", true);

    const response = await this.fetch(
      `${this.debug.url}/api/v3/users/register/authenticator/start?apikey=${this.publicKey}`,
      {
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify(payload)
      }
    );

    const body = await response.json();

    if (response.status >= 400) {
      const errorMessage = body.errorMessage || "An unknown error has occurred";
      document
        .querySelector(`.${styles.loadingOverlay}`)!
        .classList.add(styles.hidden);
      document
        .querySelector(`#register .${styles.inputContainer}`)!
        .classList.add(styles.invalid);
      document.querySelector(
        `#register .${styles.inputErrorMessage}`
      )!.textContent = errorMessage;

      const modal = document.querySelector(`.${styles.modal}`);

      if (modal) {
        modal.classList.add(styles.hidden);
      }

      this.updateMessage(errorMessage, "danger");
      this.hidePopup();
      throw new Error(errorMessage);
    }

    console.log(body);

    this.updateMessage("Please scan the QR Code with your phone");

    const qrCode = kjua({
      text: body.qr_code_data.replace("autharmor.com", "autharmor.dev"),
      rounded: 10,
      back: "#202020",
      fill: "#2cb2b5"
    });

    const popupQRCode = document.querySelector(`.${styles.qrCodeImg}`);
    popupQRCode?.classList.remove(styles.hidden);
    popupQRCode?.setAttribute("src", qrCode.src);

    this.showPopupQRCode();

    this.getEnrollmentStatus({
      id: body.user_id,
      pollDuration: 2000,
      expirationDate: Date.now() + timeoutSeconds * 1000
    });
  };

  registerMagicLink = async (username: string): Promise<void> => {
    try {
      const container = document.querySelector(
        `#register .${styles.inputContainer}`
      );
      const inputErrorMessage = document.querySelector(
        `#register .${styles.inputErrorMessage}`
      );
      const pushNotice = $(`.${styles.pushNotice}`);
      const autharmorIcon = $(`.${styles.autharmorIcon}`) as HTMLImageElement;

      this.showPopup("Please check your email", true);

      if (
        !username ||
        !/^\w+([\.\+-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(username)
      ) {
        const errorMessage = "Please specify a valid email";
        document
          .querySelector(`.${styles.loadingOverlay}`)!
          .classList.add(styles.hidden);
        container!.classList.add(styles.invalid);
        inputErrorMessage!.textContent = errorMessage;

        const modal = document.querySelector(`.${styles.modal}`);

        if (modal) {
          modal.classList.add(styles.hidden);
        }

        return;
      }

      if (pushNotice && autharmorIcon) {
        pushNotice.textContent =
          "We've sent a registration email to the address you specified";
        autharmorIcon.src = emailIcon;
      }

      const timeoutSeconds = 120;
      // TODO: Customize auth payload
      const payload = {
        action_name: "Login",
        email_address: username,
        short_msg: "Login pending - please authorize",
        timeout_in_seconds: timeoutSeconds,
        origin_location_data: { latitude: "34.05349", longitude: "-118.24532" },
        registration_redirect_url: this.registerRedirectUrl
      };

      const response = await this.fetch(
        `${this.debug.url}/api/v3/users/register/magiclink/start?apikey=${this.publicKey}`,
        {
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify(payload)
        }
      );

      const body = await response.json();

      if (response.status >= 400) {
        const errorMessage =
          body.errorMessage || "An unknown error has occurred";
        document
          .querySelector(`.${styles.loadingOverlay}`)!
          .classList.add(styles.hidden);
        document
          .querySelector(`#register .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#register .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;

        const modal = document.querySelector(`.${styles.modal}`);

        if (modal) {
          modal.classList.add(styles.hidden);
        }

        this.updateMessage(errorMessage, "danger");
        this.hidePopup();
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  registerWebAuthn = async (username: string): Promise<void> => {
    const pushNotice = document.querySelector(`.${styles.pushNotice}`);
    const qrCodeBtn = document.querySelector(`.${styles.qrcodeBtnText}`);

    if (!pushNotice || !qrCodeBtn) {
      throw new Error("DOM was unexpectedly modified");
    }

    if (!this.webauthnClientId) {
      throw new Error(
        "Please specify a valid webauthnClientId before attempting to register using webauthn"
      );
    }

    pushNotice.textContent = "Attestation in progress";
    qrCodeBtn.textContent = "Click here to scan a QR code instead";
    this.showPopup("Authenticating with WebAuthn", true);

    try {
      // TODO: Customize auth payload
      const payload = {
        username,
        webauthn_client_id: this.webauthnClientId
      };

      const startResponse = await this.fetch(
        `${this.debug.url}/api/v3/users/register/webauthn/start?apikey=${this.publicKey}`,
        {
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify(payload)
        }
      );

      const startBody = await startResponse.json();

      if (startResponse.status >= 400) {
        const errorMessage =
          startBody.errorMessage || "An unknown error has occurred";
        document
          .querySelector(`.${styles.loadingOverlay}`)!
          .classList.add(styles.hidden);
        document
          .querySelector(`#register .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#register .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;
        const modal = document.querySelector(`.${styles.modal}`);

        if (modal) {
          modal.classList.add(styles.hidden);
        }

        this.updateMessage(errorMessage, "danger");
        this.hidePopup();
        throw new Error(errorMessage);
      }

      const parsedResponse = await this.webauthn?.create(startBody);

      const finish = await this.fetch(
        `${this.debug.url}/api/v3/users/register/webauthn/finish?apikey=${this.publicKey}`,
        {
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify(parsedResponse)
        }
      );

      const finishBody = await finish.json();

      if (finish.status >= 400) {
        throw new Error(finishBody?.errorMessage);
      }

      this.updateMessage("Registered successfully!", "success");
      this.hidePopup(2000);
      this.executeEvent("registerSuccess", {
        ...finishBody,
        auth_method: "WebAuthn",
        id: startBody.registration_id
      });
    } catch (err) {
      this.updateMessage(
        err.message.includes(
          "The operation either timed out or was not allowed."
        )
          ? "User cancelled request"
          : err.message,
        "danger"
      );
      this.hidePopup(2000);
    }
  };

  loginWebAuthn = async (username: string): Promise<void> => {
    const pushNotice = document.querySelector(`.${styles.pushNotice}`);
    const qrCodeBtn = document.querySelector(`.${styles.qrcodeBtnText}`);

    if (!pushNotice || !qrCodeBtn) {
      throw new Error("DOM was unexpectedly modified");
    }

    pushNotice.textContent = "Attestation in progress";
    qrCodeBtn.textContent = "Click here to scan a QR code instead";
    this.showPopup("Authenticating with WebAuthn", true);

    try {
      // TODO: Customize auth payload
      const payload = {
        username,
        webauthn_client_id: this.webauthnClientId
      };

      const startResponse = await this.fetch(
        `${this.debug.url}/api/v3/auth/request/webauthn/start?apikey=${this.publicKey}`,
        {
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify(payload)
        }
      );

      const startBody = await startResponse.json();

      if (startResponse.status >= 400) {
        const errorMessage =
          startBody.errorMessage || "An unknown error has occurred";
        document
          .querySelector(`.${styles.loadingOverlay}`)!
          .classList.add(styles.hidden);
        document
          .querySelector(`#login .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#login .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;
        const modal = document.querySelector(`.${styles.modal}`);

        if (modal) {
          modal.classList.add(styles.hidden);
        }

        this.updateMessage(errorMessage, "danger");
        this.hidePopup();
        return;
      }

      const parsedResponse = await this.webauthn?.get(startBody);

      const finish = await this.fetch(
        `${this.debug.url}/api/v3/auth/request/webauthn/finish?apikey=${this.publicKey}`,
        {
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify({
            ...parsedResponse,
            authenticator_response_data: JSON.stringify(
              parsedResponse?.authenticator_response_data
            )
          })
        }
      );

      const finishBody = await finish.json();

      if (finish.status >= 400) {
        throw new Error(finishBody?.errorMessage);
      }

      this.executeEvent("authenticated", {
        ...finishBody,
        auth_method: "WebAuthn",
        id: startBody?.auth_request_id
      });

      this.updateMessage("Authenticated successfully!", "success");
      this.hidePopup(2000);
    } catch (err) {
      this.updateMessage(err.message, "danger");
      this.hidePopup(2000);
    }
  };

  // Authentication
  requestAuth = async (type: AuthTypes, username?: string): Promise<void> => {
    try {
      document
        .querySelector(`.${styles.loadingOverlay}`)!
        .classList.remove(styles.hidden);
      this.hasCalledValidate = false;

      const timeoutSeconds = 60;
      // TODO: Customize auth payload
      const payload = {
        action_name: "Login",
        username,
        short_msg: "Login pending - please authorize",
        timeout_in_seconds: timeoutSeconds,
        origin_location_data: { latitude: "34.05349", longitude: "-118.24532" },
        authentication_redirect_url:
          type === "magiclink" ? this.authenticationRedirectUrl : null,
        send_push: type === "push"
      };

      document
        .querySelector(`#login .${styles.inputContainer}`)!
        .classList.remove(styles.invalid);
      document
        .querySelector(`.${styles.mobileUsernameless}`)
        ?.classList.remove(styles.hidden);
      document
        .querySelector(`.${styles.qrCodeTimeout}`)
        ?.classList.add(styles.hidden);

      const response = await this.fetch(
        `${this.debug.url}/api/v3/auth/request/${
          type === "magiclink" ? type : "authenticator"
        }/start?apikey=${this.publicKey}`,
        {
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
      const body = await response.json();

      if (response.status >= 400) {
        const errorMessage =
          body.errorMessage || "An unknown error has occurred";
        document
          .querySelector(`.${styles.loadingOverlay}`)!
          .classList.add(styles.hidden);
        document
          .querySelector(`#login .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#login .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;
        const modal = document.querySelector(`.${styles.modal}`);

        if (modal) {
          modal.classList.add(styles.hidden);
        }

        this.updateMessage(errorMessage, "danger");
        this.hidePopup();
        return;
      }

      if (body.qr_code_data) {
        const qrCode = kjua({
          text: body.qr_code_data.replace("autharmor.com", "autharmor.dev"),
          rounded: 10,
          back: "#202020",
          fill: "#2cb2b5"
        });
        const popupQRCode = document.querySelector(`.${styles.qrCodeImg}`);
        popupQRCode?.classList.remove(styles.hidden);
        popupQRCode?.setAttribute("src", qrCode.src);

        if (type === "usernameless") {
          const qrCodeImg = document.querySelector(
            `.${styles.usernamelessQrImg}`
          ) as HTMLImageElement;
          qrCodeImg?.setAttribute("src", qrCode.src);
          document
            .querySelector(`.${styles.mobileUsernameless}`)
            ?.classList.remove(styles.hidden);
          document
            .querySelector(`.${styles.mobileUsernamelessBtn}`)
            ?.setAttribute(
              "href",
              body.qr_code_data.replace("autharmor.com", "autharmor.dev")
            );

          this.expirationDate = Date.now() + body.timeout_in_seconds * 1000;
          if (this.tickTimerId) {
            clearTimeout(this.tickTimerId);
          }
          this.tickTimer();
        }
      }

      if (this.pollTimerId) {
        clearTimeout(this.pollTimerId);
      }
      this.getRequestStatus({
        id: body.auth_request_id,
        pollDuration: 1000,
        usernameless: type === "usernameless"
      });
      document
        .querySelector(`.${styles.loadingOverlay}`)!
        .classList.add(styles.hidden);
    } catch (err) {
      console.error(err);
      document
        .querySelector(`.${styles.loadingOverlay}`)!
        .classList.add(styles.hidden);
      document
        .querySelector(`.${styles.criticalError}`)!
        .classList.remove(styles.hidden);
      this.updateMessage("An unknown error has occurred", "danger");
      this.hidePopup();
    }
  };

  private selectAuthMethod = (type: AuthTypes): void => {
    const pushNotice = document.querySelector(`.${styles.pushNotice}`);
    const qrCodeBtn = document.querySelector(`.${styles.qrcodeBtnText}`);
    const email = document.querySelector(
      `.${styles.email}`
    ) as HTMLInputElement;
    const container = document.querySelector(
      `#login .${styles.inputContainer}`
    );
    const inputErrorMessage = document.querySelector(
      `#login .${styles.inputErrorMessage}`
    );

    console.log("Selecting Auth method...", type);

    if (!pushNotice || !qrCodeBtn) {
      throw new Error("DOM was unexpectedly modified");
    }

    container!.classList.remove(styles.invalid);
    inputErrorMessage!.textContent = "";

    if (type === "push") {
      pushNotice.textContent = "We've sent a push message to your device(s)";
      qrCodeBtn.textContent =
        "Didn't get the push notification? Click here to scan a QR code instead";
    }

    if (type === "magiclink") {
      if (
        !email.value ||
        !/^\w+([\.\+-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email.value)
      ) {
        const errorMessage = "Please specify a valid email";
        document
          .querySelector(`.${styles.loadingOverlay}`)!
          .classList.add(styles.hidden);
        container!.classList.add(styles.invalid);
        inputErrorMessage!.textContent = errorMessage;

        console.log(`#login .${styles.inputContainer}`);

        const modal = document.querySelector(`.${styles.modal}`);

        if (modal) {
          modal.classList.add(styles.hidden);
        }

        return;
      }

      pushNotice.textContent = "We've sent a magic link to your email";
      qrCodeBtn.textContent =
        "Didn't get the magic link? Click here to scan a QR code instead";
      this.showPopup("Please check your email", true);
    }

    if (type === "webauthn") {
      pushNotice.textContent = "Assertion in progress";
      qrCodeBtn.textContent = "Click here to scan a QR code instead";
      document.querySelector(`.${styles.modal}`)!.classList.add(styles.hidden);
      this.showPopup("Please complete assertion", true);
      this.loginWebAuthn(email.value);
      return;
    }

    if (type === "push") {
      this.showPopup();
    }

    document.querySelector(`.${styles.modal}`)!.classList.add(styles.hidden);

    this.requestAuth(type, email.value);
  };

  setCardText = (messages: Record<string, string>) => {
    Object.entries(messages).map(([key, value]) => {
      if (key === "title") {
        document.querySelector(`.${styles.modalHeader}`)!.textContent = value;
        return value;
      }
      if (document.querySelector(`[data-card="${key}"] .${styles.text}`)) {
        document.querySelector(
          `[data-card="${key}"] .${styles.text}`
        )!.textContent = value;
      }
    });
  };

  mount = (selector = "", options: FormMountOptions = defaultOptions): void => {
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(
        "Please specify a valid element (example: `.form` or `#login-form`)"
      );
    }

    const parsedOptions = {
      ...defaultOptions,
      ...options
    };

    const authenticatorEnabled =
      (!parsedOptions.methods ||
        parsedOptions.methods?.includes("authenticator")) &&
      parsedOptions.usernameless !== false;

    element.innerHTML = `
      <div class="${styles.container}">
        <div class="${styles.content}">
          <div class="${styles.loadingOverlay} ${styles.hidden}">
            <div class="${styles.ldsRing}">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
          <div class="${styles.criticalError} ${styles.hidden}">
            <div class="${styles.errorIcon}">
              <img src="" alt="Error" />
            </div>
            <p class="${styles.errorTitle}">Something went wrong</p>
            <p class="${styles.errorDesc}">
              An error has occurred while communicating with the AuthArmor API,
              please make sure you've added the following domain to the allowed
              domains list: "${location.host}"
            </p>
          </div>
          <div class="${styles.tabs}">
            <div class="${styles.tab} ${styles.activeTab}" data-tab="login">
              Login
            </div>
            <div class="${styles.tab}" data-tab="register">Register</div>
          </div>
          <div
            id="login"
            class="${styles.tabContent}" 
            style="display: block; ${
              !authenticatorEnabled ? "min-height: 164px;" : ""
            }">
            <div class="${styles.infoContainer}">
              ${
                authenticatorEnabled
                  ? `
                    <p class="${styles.headerText}">
                      Sign in using the Auth Armor Authenticator app
                    </p>
                    <div class="${styles.qrCode}">
                      <img src="" alt="" class="${styles.usernamelessQrImg}">
                      ${
                        isMobile()
                          ? `<div class="${styles.mobileUsernameless}">
                               <p class="${styles.mobileUsernamelessTitle}">Usernameless login</p>
                               <a class="${styles.mobileUsernamelessBtn}">Login with App</a>
                             </div>`
                          : ""
                      }
                      <div class="${styles.qrCodeTimeout} ${styles.hidden}">
                        <div class="${styles.timeoutHead}">Code timed out!</div>
                        <div class="${styles.timeoutBtn}">Refresh Code</div>
                      </div>
                    </div>
                    <p class="${
                      styles.desc
                    }">Scan this QR code using the app to sign in</p>
                    <div class="${styles.timerContainer}">
                      <p class="${styles.timer}">00:43</p>
                      <div class="${styles.refresh}">
                        <img src="${refreshIcon}" alt="refresh-btn" />
                      </div>
                    </div>
                    <div class="${styles.separator}">
                      <p>OR</p>
                    </div>
                  `
                  : ""
              }
              <p class="${styles.headerText}">
                Sign in with your username
              </p>
              <div class="${styles.inputContainer}">
                  <input
                    class="${styles.email} ${styles.loginEmail}" 
                    type="text" 
                    placeholder="Username"
                  />
                  <div class="${styles.inputErrorMessage}">
                    An unknown error has occurred
                  </div>
              </div>
            </div>
            <div
              class="${styles.btn} ${
      parsedOptions.methods?.includes("webauthn") ? "" : styles.disabled
    }"
              data-btn="login">
              <p>Login</p>
            </div>
          </div>
          <form
            id="register"
            class="${styles.tabContent}" 
            style="${!authenticatorEnabled ? "min-height: 164px;" : ""}">
            <div class="${styles.infoContainer}">
              <p class="${styles.headerText}">
                Sign up with your username
              </p>
              <div class="${styles.inputContainer}">
                <input 
                  class="${styles.email}" 
                  type="text" 
                  placeholder="Username"
                />
                <div class="${styles.inputErrorMessage}">
                  An unknown error has occurred
                </div>
              </div>
            </div>
            <div class="${styles.btn} ${styles.disabled}" data-btn="register">
              <p>Register</p>
            </button>
          </form>
        </div>
      </div>
      <div class="${styles.modal} ${styles.hidden}">
        <div class="${styles.modalBackground}"></div>
        <div class="${styles.modalContainer}">
          <p class="${styles.modalHeader}">Pick your auth method</p>
          <div class="${styles.cards}">
            ${
              !parsedOptions.methods ||
              parsedOptions.methods?.includes("authenticator")
                ? `
                  <div class="${
                    styles.card
                  }" data-card="push" style="width: calc((100% / ${parsedOptions
                    .methods?.length ?? 3}) - 15px)">
                    <div class="${styles.icon}">
                      <img src="${phoneIcon}" alt="icon" />
                    </div>
                    <p class="${styles.title}">Push Authentication</p>
                    <p class="${styles.text}">
                      Send me a push message to my Auth Armor authenticator to login
                    </p>
                  </div>
                  `
                : ""
            }

            ${
              !parsedOptions.methods ||
              parsedOptions.methods.includes("magiclink")
                ? `
                  <div class="${styles.card} ${
                    styles.email
                  }" data-card="magiclink" style="width: calc((100% / ${parsedOptions
                    .methods?.length ?? 3}) - 15px)">
                    <div class="${styles.icon}">
                      <img src="${emailIcon}" alt="icon" />
                    </div>
                    <p class="${styles.title}">Magic Link Login Email</p>
                    <p class="${styles.text}">
                      Send me a magic link email to login
                    </p>
                  </div>`
                : ""
            }

            ${
              !parsedOptions.methods ||
              parsedOptions.methods.includes("webauthn")
                ? `
                  <div class="${
                    styles.card
                  }" data-card="webauthn" style="width: calc((100% / ${parsedOptions
                    .methods?.length ?? 3}) - 15px)">
                    <div class="${styles.icon}">
                      <img src="${emailIcon}" alt="icon" />
                    </div>
                    <p class="${styles.title}">WebAuthn</p>
                    <p class="${styles.text}">
                      Login using WebAuthn
                    </p>
                  </div>`
                : ""
            }
          </div>
          <p class="${styles.another}">Choose another method</p>
        </div>
      </div>
    `;

    const tabs = document.querySelectorAll(`.${styles.tab}`) as NodeListOf<
      HTMLDivElement
    >;
    const btns = document.querySelectorAll(`.${styles.btn}`) as NodeListOf<
      HTMLDivElement
    >;
    const cards = document.querySelectorAll(`.${styles.card}`) as NodeListOf<
      HTMLDivElement
    >;
    const modalBg = document.querySelector(
      `.${styles.modalBackground}`
    ) as HTMLDivElement;

    tabs.forEach(tab => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      tab.addEventListener("click", function(e) {
        self.selectTab(e, this.dataset.tab as "register" | "login");
      });
    });

    document
      .querySelectorAll<HTMLInputElement>(`.${styles.email}`)
      .forEach(input => {
        input.addEventListener("input", () => {
          document
            .querySelectorAll<HTMLInputElement>(`.${styles.email}`)
            .forEach(otherInput => {
              otherInput.value = input.value;
            });
        });
      });

    btns.forEach(btn => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      btn.addEventListener("click", function() {
        const modal = document.querySelector(
          `.${styles.modal}`
        ) as HTMLDivElement;
        const loginUsername = document.querySelector(
          `#login .${styles.email}`
        ) as HTMLInputElement;
        const registerUsername = document.querySelector(
          `#register .${styles.email}`
        ) as HTMLInputElement;

        if (this.dataset.btn === "login") {
          const messages = {
            title: "Pick your auth method",
            push:
              "Send me a push message to my Auth Armor authenticator to login",
            magiclink: "Send me a magic link email to login",
            webauthn: "Login using WebAuthn"
          };

          self.setCardText(messages);

          if (parsedOptions.methods?.length === 1) {
            const [method] = parsedOptions.methods;
            self.selectAuthMethod(method === "authenticator" ? "push" : method);
            return;
          }

          if (
            parsedOptions.methods?.includes("webauthn") &&
            !loginUsername.value
          ) {
            self.selectAuthMethod("webauthn");
            return;
          }
        }

        if (this.dataset.btn === "register") {
          const messages = {
            title: "Pick your registration method",
            push:
              "Send me a push message to my Auth Armor authenticator to register",
            magiclink: "Send me a magic link email to register",
            webauthn: "Register using WebAuthn"
          };

          self.setCardText(messages);

          if (parsedOptions.methods?.length === 1) {
            const [method] = parsedOptions.methods;
            const register: Record<AuthMethods, () => Promise<void>> = {
              magiclink: () => self.registerMagicLink(registerUsername.value),
              webauthn: () => self.registerWebAuthn(registerUsername.value),
              authenticator: () =>
                self.registerAuthenticator(registerUsername.value)
            };

            register[method]();
            return;
          }
        }

        if (modal) {
          modal.dataset.type = this.dataset.btn;
          modal.classList.remove(styles.hidden);
        }
      });
    });

    if (modalBg) {
      modalBg.addEventListener("click", this.closeModal);
    }

    cards.forEach(card =>
      card.addEventListener("click", () => {
        const type = card.dataset.card as AuthTypes;
        const modal = document.querySelector(
          `.${styles.modal}`
        ) as HTMLDivElement;
        const registerUsername = document.querySelector(
          `#register .${styles.email}`
        ) as HTMLInputElement;

        if (modal.dataset.type === "login") {
          this.selectAuthMethod(type);
        }

        if (modal.dataset.type === "register") {
          const register: Record<AuthTypes, () => Promise<void>> = {
            magiclink: () => this.registerMagicLink(registerUsername.value),
            webauthn: () => this.registerWebAuthn(registerUsername.value),
            push: () => this.registerAuthenticator(registerUsername.value),
            usernameless: () =>
              this.registerAuthenticator(registerUsername.value)
          };

          register[type]();
        }
      })
    );

    document
      .querySelector(`.${styles.refresh}`)
      ?.addEventListener("click", () => {
        this.requestAuth("usernameless");
      });

    document
      .querySelector(`.${styles.timeoutBtn}`)
      ?.addEventListener("click", () => {
        this.requestAuth("usernameless");
      });

    document
      .querySelector(`#register .${styles.email}`)
      ?.addEventListener("input", e => {
        if ((e.target as HTMLInputElement).value?.trim()) {
          document
            .querySelector(`#register .${styles.btn}`)
            ?.classList.remove(styles.disabled);
        } else {
          document
            .querySelector(`#register .${styles.btn}`)
            ?.classList.add(styles.disabled);
        }
      });

    document
      .querySelector(`#login .${styles.email}`)
      ?.addEventListener("input", e => {
        if (
          (e.target as HTMLInputElement).value?.trim() ||
          parsedOptions.methods?.includes("webauthn")
        ) {
          document
            .querySelector(`#login .${styles.btn}`)
            ?.classList.remove(styles.disabled);
        } else {
          document
            .querySelector(`#login .${styles.btn}`)
            ?.classList.add(styles.disabled);
        }
      });

    if (authenticatorEnabled) {
      console.log("Getting usernameless data");
      this.requestAuth("usernameless");
      this.tickTimer();
    }

    this.updateModalText();
  };

  setStyle = (styles: FormStyles): void => {
    const cssVariables: { [x: string]: string } = {
      accentColor: "--autharmor-accent-color",
      backgroundColor: "--autharmor-background-color",
      tabColor: "--autharmor-tab-color",
      qrCodeBackground: "--autharmor-qr-code-background",
      highlightColor: "--autharmor-highlight-color",
      inputBackground: "--autharmor-input-background"
    };

    Object.entries(styles).map(([key, value]) => {
      if (key in cssVariables && typeof cssVariables[key] === "string") {
        document.body.style.setProperty(cssVariables[key], value);
      }
    });
  };

  // -- Event Listener functions

  public on(eventName: Events, fn: EventListener): void {
    this.ensureEventExists(eventName);

    const listeners = this.eventListeners.get(eventName) ?? [];
    this.eventListeners.set(eventName, [...listeners, fn]);
  }

  public off(eventName: Events): void {
    this.ensureEventExists(eventName);

    this.eventListeners.set(eventName, []);
  }

  // -- Invite functionality

  private setInviteData = ({ inviteCode, signature }: InviteData) => {
    if (!inviteCode || !signature) {
      throw new Error("Please specify an invite code and a signature");
    }

    return {
      getQRCode: ({
        backgroundColor = "#202020",
        fillColor = "#2cb2b5",
        borderRadius = 0
      } = {}) => {
        const stringifiedInvite = JSON.stringify({
          type: "profile_invite",
          payload: {
            invite_code: inviteCode,
            aa_sig: signature
          }
        });
        const code = kjua({
          text: stringifiedInvite,
          rounded: borderRadius,
          back: backgroundColor,
          fill: fillColor
        });
        return code.src;
      },
      getInviteLink: () => {
        return `${config.inviteURL}/?i=${inviteCode}&aa_sig=${signature}`;
      },
      openInviteLink: () => {
        this.showPopup("Approve invite request");
        this.popupWindow(
          `${config.inviteURL}/?i=${inviteCode}&aa_sig=${signature}`,
          "Link your account with AuthArmor",
          600,
          400
        );
      }
    };
  };

  private generateInviteCode = async ({
    nickname,
    headers,
    referenceId,
    reset
  }: InviteOptions) => {
    try {
      if (!nickname) {
        throw new Error("Please specify a nickname for the invite code");
      }

      const { data } = await Axios.post(
        `/invite`,
        {
          nickname,
          referenceId,
          reset
        },
        { withCredentials: true, headers }
      );

      return {
        ...data,
        getQRCode: ({
          backgroundColor = "#202020",
          fillColor = "#2cb2b5",
          borderRadius = 0
        } = {}) => {
          const stringifiedInvite = data.qr_code_data;
          const code = kjua({
            text: stringifiedInvite,
            rounded: borderRadius,
            back: backgroundColor,
            fill: fillColor
          });
          return code.src;
        },
        getInviteLink: () => {
          return `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`;
        },
        openInviteLink: () => {
          this.showPopup(undefined, true);
          this.popupWindow(
            `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`,
            "Link your account with AuthArmor",
            600,
            400
          );
        }
      };
    } catch (err) {
      throw err?.data ?? err;
    }
  };

  private getInviteById = async ({ id, headers }: InviteIdOptions) => {
    try {
      if (!id) {
        throw new Error("Please specify a nickname for the invite code");
      }

      const { data } = await Axios.get(`/invite/${id}`, { headers });

      return {
        ...data,
        getQRCode: ({
          backgroundColor = "#202020",
          fillColor = "#2cb2b5",
          borderRadius = 0
        } = {}) => {
          const stringifiedInvite = data.qr_code_data;
          const code = kjua({
            text: stringifiedInvite,
            rounded: borderRadius,
            back: backgroundColor,
            fill: fillColor
          });
          return code.src;
        },
        getInviteLink: () => {
          return `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`;
        },
        openInviteLink: () => {
          this.showPopup(undefined, true);
          this.popupWindow(
            `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`,
            "Link your account with AuthArmor",
            600,
            400
          );
        }
      };
    } catch (err) {
      throw err?.data ?? err;
    }
  };

  private getInvitesByNickname = async ({
    nickname,
    headers
  }: InviteNicknameOptions) => {
    try {
      if (!nickname) {
        throw new Error("Please specify a nickname for the invite code");
      }

      const { data } = await Axios.get(`/invites/${nickname}`, { headers });

      return {
        ...data,
        getQRCode: ({
          backgroundColor = "#202020",
          fillColor = "#2cb2b5",
          borderRadius = 0
        } = {}) => {
          const stringifiedInvite = data.qr_code_data;
          const code = kjua({
            text: stringifiedInvite,
            rounded: borderRadius,
            back: backgroundColor,
            fill: fillColor
          });
          return code.src;
        },
        getInviteLink: () => {
          return `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`;
        },
        openInviteLink: () => {
          this.showPopup(undefined, true);
          this.popupWindow(
            `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`,
            "Link your account with AuthArmor",
            600,
            400
          );
        }
      };
    } catch (err) {
      throw err?.data ?? err;
    }
  };

  private logout = async () => {
    try {
      const { data } = await Axios.get(`/logout`, {
        withCredentials: true
      });
      return data;
    } catch (err) {
      throw err?.data ?? err;
    }
  };

  // -- Authentication functionality

  private onAuthResponse = ({
    authResponse,
    redirectedUrl,
    onSuccess,
    onFailure
  }: OnAuthResponse) => {
    const responseMessage =
      authResponse.response?.auth_response?.response_message;
    const nickname =
      authResponse.response?.auth_response?.auth_details?.request_details
        ?.auth_profile_details?.nickname;
    const authorized = authResponse.response?.auth_response?.authorized;

    console.debug({ authResponse });

    if (redirectedUrl) {
      this.updateMessage("Authentication request approved!", "success");
      window.location.href = redirectedUrl;
      return true;
    }

    if (authResponse.authorized) {
      this.updateMessage("Authentication request approved!", "success");
      onSuccess?.({
        ...authResponse,
        nickname,
        authorized,
        status: responseMessage
      });
      return true;
    }

    if (!authResponse.authorized && responseMessage === "timeout") {
      this.updateMessage("Authentication request timed out", "warn");
      onFailure?.({
        ...authResponse,
        nickname,
        authorized,
        status: responseMessage
      });
      return true;
    }

    if (!authResponse.authorized && responseMessage === "Declined") {
      this.updateMessage("Authentication request declined", "danger");
      onFailure?.({
        ...authResponse,
        nickname,
        authorized,
        status: responseMessage
      });
      return true;
    }

    return false;
  };

  private pollAuthRequest = async ({
    id,
    headers,
    onSuccess,
    onFailure
  }: PollAuthRequest) => {
    try {
      const {
        data: authResponse,
        redirect,
        url
      }: Response<any> = await Axios.get(`/authenticate/status/${id}`, {
        headers
      });

      const urlMismatch = url !== this.url + `/authenticate/status/${id}`;

      const pollComplete = this.onAuthResponse({
        authResponse: {
          authorized: authResponse.auth_response?.authorized,
          response: authResponse,
          nickname:
            authResponse.auth_response?.auth_details.response_details
              .auth_profile_details.nickname,
          status: authResponse.auth_request_status_name,
          token: ""
        },
        redirectedUrl: urlMismatch || redirect ? url : undefined,
        onSuccess,
        onFailure
      });

      if (!pollComplete) {
        setTimeout(() => {
          this.pollAuthRequest({
            id,
            onSuccess,
            onFailure
          });
        }, this.pollInterval);
        return;
      }

      this.hidePopup();
    } catch (err) {
      console.debug("An error has occurred while polling:", err);
      this.hidePopup();
    }
  };

  private authenticate = async ({
    nickname,
    sendPush = true,
    visualVerify = false,
    showPopup = true,
    actionName,
    shortMessage,
    locationData,
    headers,
    onSuccess,
    onFailure
  }: AuthenticateArgs) => {
    try {
      if (showPopup === true || (sendPush && showPopup !== false)) {
        const qrCodeImage = $(`.${styles.qrCodeImg}`);
        qrCodeImage?.classList.add(styles.hidden);
        this.showPopup();
      }

      const { data }: Response<AuthRequest> = await Axios.post(
        `/authenticate`,
        {
          nickname,
          send_push: sendPush && nickname?.length > 0,
          use_visual_verify: visualVerify,
          action_name: actionName,
          short_msg: shortMessage,
          origin_location_data: locationData
        },
        { withCredentials: true, headers }
      );
      if (showPopup === true || (sendPush && showPopup !== false)) {
        const qrCode = kjua({
          text: data.qr_code_data,
          rounded: 10,
          back: "#202020",
          fill: "#2cb2b5"
        }).src;
        const qrCodeImage = $(`.${styles.qrCodeImg}`);
        qrCodeImage?.classList.remove(styles.hidden);
        qrCodeImage?.setAttribute("src", qrCode);
      }

      const visualVerifyElement = $(
        `.${styles.visualVerifyIcon}`
      ) as HTMLDivElement;

      if (visualVerifyElement && data.visual_verify_value) {
        visualVerifyElement.classList.remove(styles.hidden);
        visualVerifyElement.textContent = data.visual_verify_value;
        visualVerifyElement.style.backgroundColor = generateColor(
          data.visual_verify_value
        );
      }

      return {
        ...data,
        getTimeLeft: () =>
          new Date(data.timeout_utc_datetime).getTime() - Date.now(),
        getQRCode: ({
          backgroundColor = "#202020",
          fillColor = "#2cb2b5",
          borderRadius = 0
        } = {}) =>
          kjua({
            text: data.qr_code_data,
            rounded: borderRadius ?? 10,
            back: backgroundColor,
            fill: fillColor
          }).src
      };
    } catch (err) {
      console.error(err);
      this.hidePopup();
      throw err?.data ?? err;
    }
  };

  // Get if user is authenticated
  private getUser = async () => {
    try {
      const { data } = await Axios.get(`/me`, {
        withCredentials: true
      });
      return data;
    } catch (err) {
      throw err?.data ?? err;
    }
  };

  // Public interfacing SDK functions

  get invite() {
    return {
      generateInviteCode: this.generateInviteCode,
      setInviteData: this.setInviteData,
      getInviteById: this.getInviteById,
      getInvitesByNickname: this.getInvitesByNickname
    };
  }

  get auth() {
    return {
      authenticate: this.authenticate,
      getUser: this.getUser,
      logout: this.logout
    };
  }

  get popup() {
    return {
      show: this.showPopup,
      hide: this.hidePopup,
      updateMessage: this.updateMessage
    };
  }

  get form() {
    return {
      mount: this.mount,
      stylize: this.setStyle
    };
  }
}

window.AuthArmorSDK = SDK;

export default SDK;

import kjua from "kjua";
import WebAuthnSDK from "autharmor-webauthn-sdk";
import { ReCaptchaInstance, load } from "recaptcha-v3";
import { v4 as uuidv4 } from "uuid";
import styles from "./css/index.module.css";
import config from "./config/index";
import qrCode from "./assets/qr-code.svg";
import logo from "./assets/logo.png";
import closeIcon from "./assets/cancel.svg";
import refreshIcon from "./assets/refresh.svg";
import phoneIcon from "./assets/phone.svg";
import emailIcon from "./assets/email.svg";

type Events =
  | "authenticating"
  | "authSuccess"
  | "authTimeout"
  | "authDeclined"
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

type AuthTypes = "magiclink-email" | "push" | "usernameless" | "webauthn";

export type AuthMethods = "authenticator" | "magiclink-email" | "webauthn";

type EventListener = (...data: any) => void | Promise<void>;

interface LocationData {
  latitude: string;
  longitude: string;
}

export interface FormStyles {
  accentColor: string;
  backgroundColor: string;
  tabColor: string;
  qrCodeBackground: string;
  highlightColor: string;
  inputBackground: string;
  appBtn: string;
}

interface Preferences {
  action_name: string;
  username: string;
  custom_message: string;
  short_msg: string;
  timeout_in_seconds: number;
  context_data: {
    [x: string]: string;
  };
  origin_location_data: LocationData;
}

interface AuthenticatorPreferences extends Preferences {
  send_push: boolean;
}

interface FormAuthTypePreferences {
  default?: Partial<AuthenticatorPreferences>;
  authenticator?: Partial<AuthenticatorPreferences>;
  magicLink?: Partial<Preferences>;
  webauthn?: Partial<Preferences>;
}

export interface FormPreferences {
  register: FormAuthTypePreferences;
  auth: FormAuthTypePreferences;
}

interface FormMountOptions {
  methods?: AuthMethods[];
  usernameless?: boolean;
  preferences?: Partial<FormPreferences>;
  styles?: Partial<FormStyles>;
  defaultTab?: "login" | "register";
  visualVerify?: boolean;
}

const defaultOptions: FormMountOptions = {
  methods: ["authenticator", "magiclink-email", "webauthn"],
  usernameless: true,
  visualVerify: false,
  defaultTab: "login",
  styles: {
    accentColor: "#0bdbdb",
    backgroundColor: "#2a2d35",
    tabColor: "#363a46",
    qrCodeBackground: "#202020"
  }
};

interface DebugSettings {
  url: string;
}

interface SDKConfig {
  clientSdkApiKey: string;
  webauthnClientId: string;
  registerRedirectUrl: string;
  authenticationRedirectUrl: string;
  getNonce?: () => string;
  debug?: DebugSettings;
}

declare global {
  interface Window {
    AuthArmorSDK?: typeof SDK;
    AuthArmor: any;
  }
}

const $ = (selectors: string) => document.querySelector(selectors);

const isMobile = () => {
  const toMatch = /(Android|iPhone|iPad|iPod)/i;

  return navigator.userAgent.match(toMatch);
};

const isIOS = () => !!navigator.userAgent.match(/(iPhone|iPad|iPod)/i)?.length;

class SDK {
  private publicKey?: string;
  private webauthnClientId?: string;
  private webauthn?: WebAuthnSDK;
  private events: Events[];
  private eventListeners: Map<Events, EventListener[]>;
  private tickTimerId?: NodeJS.Timeout;
  private requestCompleted = false;
  private expirationDate = Date.now();
  private pollTimerId?: NodeJS.Timeout;
  private QRAnimationTimer?: NodeJS.Timeout;
  private hasCalledValidate = false;
  private registerRedirectUrl?: string;
  private authenticationRedirectUrl?: string;
  private preferences?: FormPreferences;
  private recaptcha?: ReCaptchaInstance;
  private recaptchaSiteKey = "";
  private customOptions?: Partial<Preferences>;
  private getNonce?: () => void;
  private visualVerify?: boolean;
  private tempRequests: AbortController[] = [];
  private debug: DebugSettings = {
    url: "https://auth.autharmor.dev"
  };
  textTimer?: NodeJS.Timer;
  textFadeTimer?: NodeJS.Timer;
  textIndex = 0;
  loadingText = [
    "Securing Connections...",
    "Checking Encryption...",
    "Validating Ciphers...",
    "Encoding Data..."
  ];

  constructor({
    clientSdkApiKey = "",
    webauthnClientId = "",
    registerRedirectUrl = "",
    authenticationRedirectUrl = "",
    getNonce,
    debug = { url: "https://auth.autharmor.dev" }
  }: SDKConfig) {
    console.log("AuthArmor SDK v3.0.0-beta.5");

    if (registerRedirectUrl) {
      this.registerRedirectUrl = registerRedirectUrl;
    }

    if (authenticationRedirectUrl) {
      this.authenticationRedirectUrl = authenticationRedirectUrl;
    }

    if (!clientSdkApiKey) {
      throw new Error("Please specify a valid public key!");
    }

    console.log(debug);

    if (debug) {
      this.debug = debug;
    }

    if (getNonce) {
      this.getNonce = getNonce;
    }

    this.publicKey = clientSdkApiKey;
    this.webauthnClientId = webauthnClientId;
    if (webauthnClientId) {
      this.webauthn = new WebAuthnSDK({
        webauthnClientId
      });
    }

    // Supported events
    this.events = [
      "authenticating",
      "authSuccess",
      "authTimeout",
      "authDeclined",
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

  private closePopupListener = () => this.hidePopup(0);

  private showQRCodeListener = () => this.showPopupQRCode();

  private showPopup = (message = "Waiting for device", hideQRBtn?: boolean) => {
    const popupOverlay = document.querySelector(`.${styles.popupOverlay}`);
    const showQRCodeBtn = document.querySelector(
      `.${styles.showPopupQrcodeBtn}`
    );
    const hideQRCodeBtn = document.querySelector(
      `.${styles.hidePopupQrcodeBtn}`
    );
    const closePopupBtn = $(`.${styles.closePopupBtn}`);

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

    closePopupBtn?.addEventListener("click", this.closePopupListener);
    showQRCodeBtn?.addEventListener("click", this.showQRCodeListener);

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
      const closePopupBtn = $(`.${styles.closePopupBtn}`);
      const showQRCodeBtn = document.querySelector(
        `.${styles.showPopupQrcodeBtn}`
      );

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

      this.clearRequests();
      this.hidePopupQRCode();
      closePopupBtn?.removeEventListener("click", this.closePopupListener);
      showQRCodeBtn?.removeEventListener("click", this.showQRCodeListener);
    }, delay);
  };

  private updateMessage = (
    message: string,
    status: "danger" | "warn" | "success" = "success"
  ) => {
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

  private hideLoading = () => {
    document
      .querySelector(`.${styles.loadingOverlay}`)
      ?.classList.add(styles.hidden);

    if (this.textTimer) {
      clearInterval(this.textTimer);
    }

    if (this.textFadeTimer) {
      clearTimeout(this.textFadeTimer);
    }
  };

  private showLoading = () => {
    document
      .querySelector(`.${styles.loadingOverlay}`)
      ?.classList.remove(styles.hidden);

    if (this.textTimer) {
      clearInterval(this.textTimer);
    }

    if (this.textFadeTimer) {
      clearTimeout(this.textFadeTimer);
    }

    document
      .querySelector(`.${styles.loadingText}`)
      ?.classList.remove(styles.hidden);

    this.textTimer = setInterval(() => {
      this.swapLoadingText();
    }, 1000);
  };

  private swapLoadingText = () => {
    if (this.textIndex > this.loadingText.length - 1) {
      this.textIndex = 0;
    }

    const loadingTextElement = document.querySelector(`.${styles.loadingText}`);

    if (loadingTextElement) {
      loadingTextElement.classList.add(styles.hidden);
      this.textFadeTimer = setTimeout(() => {
        loadingTextElement.textContent = this.loadingText[this.textIndex];
        loadingTextElement.classList.remove(styles.hidden);
        this.textIndex += 1;
      }, 250);
    }
  };

  private showPopupQRCode = (keepButton?: boolean) => {
    const showPopupQrBtn = $(`.${styles.showPopupQrcodeBtn}`);
    const hidePopupQrBtn = $(`.${styles.hidePopupQrcodeBtn}`);
    const authMessage = $(`.${styles.authMessage}`);
    const qrCodeContainer = $(`.${styles.qrCodeImgContainer}`);
    const autharmorIcon = $(`.${styles.autharmorIcon}`);
    const pushNotice = $(`.${styles.pushNotice}`);
    const openBtns = document.querySelectorAll(
      `.${styles.qrCodeMobile} .${styles.mobileUsernamelessBtn}`
    );

    if (this.QRAnimationTimer) {
      clearTimeout(this.QRAnimationTimer);
    }

    // if (isMobile() && !isIOS()) {
    //   window.open((qrCodeContainer as HTMLDivElement).dataset.link, "_blank");
    // }

    if (!keepButton) {
      showPopupQrBtn?.classList.add(styles.hidden);
    } else {
      showPopupQrBtn?.classList.remove(styles.hidden);
    }

    autharmorIcon?.classList.add(styles.hidden);
    this.QRAnimationTimer = setTimeout(() => {
      qrCodeContainer?.classList.remove(styles.hidden);
      if (!keepButton) {
        authMessage?.classList.add(styles.rounded);
      } else {
        hidePopupQrBtn?.classList.remove(styles.hidden);
      }
      pushNotice?.classList.add(styles.hidden);
    }, 200);
  };

  private hidePopupQRCode = (skipAnimation?: boolean) => {
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
    this.QRAnimationTimer = setTimeout(
      () => {
        autharmorIcon?.classList.remove(styles.hidden);
        showPopupQrBtn?.classList.remove(styles.hidden);
        authMessage?.classList.remove(styles.rounded);
        pushNotice?.classList.remove(styles.hidden);
      },
      skipAnimation === true ? 0 : 200
    );
  };

  private getSDKConfig = async () => {
    try {
      const config = await this.fetch(
        `${this.debug.url}/api/v3/config/sdkinit?apikey=${this.publicKey}`
      ).then(res => res.json());

      console.log(config);

      return {
        recaptcha: {
          enabled: config.google_v3_recaptcha_enabled,
          siteId: config.google_v3_recpatcha_site_id
        }
      };
    } catch (err) {
      return {
        recaptcha: {
          enabled: false,
          siteId: null
        }
      };
    }
  };

  private init = () => {
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
            <p class="${styles.pushNotice}">
              We've sent a push message to your device(s)
            </p>
            <img
              src="${logo}" 
              alt="AuthArmor Icon" 
              class="${styles.autharmorIcon}"
            />
            <div class="${styles.qrCodeImgContainer} ${styles.hidden} ${
      isMobile() ? styles.qrCodeMobile : ""
    }">
              ${
                isMobile()
                  ? `
                      <div class="${styles.mobileUsernameless}">
                        <p class="${
                          styles.mobileUsernamelessNote
                        }">Your request has been initialized! You can click the button below to approve it through the app</p>
                        <a href="#" target="_blank" class="${
                          styles.mobileUsernamelessBtn
                        }">
                          <div class="${
                            styles.mobileUsernamelessIconContainer
                          }">
                            <img src="${logo}" class="${
                      styles.mobileUsernamelessIcon
                    }" />
                          </div>
                          Login with App (${isIOS() ? "iOS" : "Android"})
                        </a>
                      </div>
                    `
                  : `
                      <img src="" alt="QR Code" class="${styles.qrCodeImg}" />
                      <p class="${styles.qrCodeImgDesc}">
                        Please scan the code with the AuthArmor app
                      </p>
                    `
              }
            </div>
          </div>
          <div class="${styles.authNotice} ${styles.hidden}">
            This dialog will close once you have successfully paired the app
          </div>
          <div class="${styles.authMessage}">
            <span class="${styles.authMessageText}">
              Authenticating with AuthArmor...
            </span>
            <span class="${styles.pulse}"></span>
          </div>
          ${
            isMobile()
              ? `
                  <a rel="noreferrer noopener" class="${styles.showPopupQrcodeBtn}">
                    <p class="${styles.qrcodeBtnText}">Tap here to launch request in app</p>
                  </a>
                `
              : `
                  <div class="${styles.showPopupQrcodeBtn}">
                    <p class="${styles.qrcodeBtnText}">
                      Didn't get the push notification? Click here to scan a QR code instead
                    </p>
                  </div>
                `
          }
        </div>
      </div>
    `;

    const showPopupQrBtn = $(`.${styles.showPopupQrcodeBtn}`);
    const hidePopupQrBtn = $(`.${styles.hidePopupQrcodeBtn}`);

    showPopupQrBtn?.addEventListener("click", () => this.showPopupQRCode());

    hidePopupQrBtn?.addEventListener("click", () => this.hidePopupQRCode());

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

    document
      .querySelectorAll<HTMLAnchorElement>(`.${styles.mobileUsernamelessBtn}`)
      .forEach(link => {
        link.removeEventListener("click", this.onLinkClick);

        link.addEventListener("click", this.onLinkClick);
      });
  };

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

    if (document.querySelector(`[data-card='magiclink-email']`)) {
      document.querySelector(
        `[data-card='magiclink-email'] .${styles.title}`
      )!.textContent = currentText.magiclink.title;
      document.querySelector(
        `[data-card='magiclink-email'] .${styles.text}`
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
    const nonce = uuidv4().replace(/-/g, "");

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

  private fetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        "X-AuthArmor-ClientMsgSigv1": await this.getRequestSignature(
          url,
          options.body as string
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
      body.authenticator_enrollment_status === "not_enrolled_or_not_found" &&
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
      body.authenticator_enrollment_status === "not_enrolled_or_not_found"
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
      body.authenticator_enrollment_status !== "not_enrolled_or_not_found" &&
      !this.hasCalledValidate
    ) {
      const registerUsername = document.querySelector(
        `#register .${styles.email}`
      ) as HTMLInputElement;
      this.hasCalledValidate = true;
      // TODO: Do something on success
      this.executeEvent("registerSuccess", {
        ...body,
        auth_method: "AuthArmorAuthenticator",
        username: registerUsername.value,
        id
      });
      this.updateMessage("Registered successfully!", "success");
      this.hidePopup(2000);
    }

    if (this.pollTimerId) {
      clearTimeout(this.pollTimerId);
    }
  };

  private clearRequests = () => {
    this.tempRequests.map(request => request.abort());
    this.tempRequests = [];
    if (this.pollTimerId) {
      clearTimeout(this.pollTimerId);
    }
  };

  private getRequestStatus = async ({
    id = "",
    token = "",
    pollDuration = 2000,
    usernameless = false
  } = {}): Promise<void> => {
    const controller = !usernameless ? new AbortController() : null;

    if (controller) {
      this.tempRequests = [...this.tempRequests, controller];
    }

    const body = await this.fetch(
      `${this.debug.url}/api/v3/auth/request/status/${id}?apikey=${this.publicKey}`,
      {
        method: "GET",
        signal: controller?.signal
      }
    )
      .then(response => response.json())
      .catch(err => console.error(err));

    if (
      pollDuration &&
      body?.auth_request_status_id === 3 &&
      body?.auth_response_code === 0
    ) {
      const timer = setTimeout(() => {
        this.hasCalledValidate = false;
        this.getRequestStatus({ id, token, pollDuration, usernameless });
      }, pollDuration);

      if (!usernameless) {
        this.pollTimerId = timer;
      }

      return;
    }

    if (
      body?.auth_request_status_id === 4 &&
      body?.auth_response_code === 8 &&
      !this.hasCalledValidate
    ) {
      // TODO: Do something on success
      this.hasCalledValidate = true;
      this.executeEvent("authSuccess", { ...body, id, token });
      this.updateMessage("Authenticated successfully!", "success");
      this.hidePopup(2000);
    }

    if (
      body?.auth_request_status_id === 2 &&
      body?.auth_response_code === 5 &&
      !this.hasCalledValidate
    ) {
      if (usernameless) {
        document
          .querySelector(`.${styles.qrCodeTimeout}`)!
          .classList.remove(styles.hidden);
        document
          .querySelector(`.${styles.mobileUsernameless}`)
          ?.classList.add(styles.hidden);
      }

      if (!usernameless) {
        this.executeEvent("authTimeout", { ...body, id, token });
        this.updateMessage("Authentication timed out", "warn");
        this.hidePopup(2000);
      }

      this.hasCalledValidate = false;
    }

    if (
      body?.auth_request_status_id === 2 &&
      body?.auth_response_code === 3 &&
      !this.hasCalledValidate
    ) {
      console.log("Request declined!", usernameless);
      if (usernameless) {
        document
          .querySelector(`.${styles.qrCodeTimeout}`)!
          .classList.remove(styles.hidden);
        document
          .querySelector(`.${styles.mobileUsernameless}`)
          ?.classList.add(styles.hidden);

        if (this.tickTimerId) {
          clearTimeout(this.tickTimerId);
        }
      }

      if (!usernameless) {
        this.executeEvent("authDeclined", { ...body, id, token });
        this.updateMessage("User declined request", "danger");
        this.hidePopup(2000);
      }

      this.hasCalledValidate = false;
    }

    if (this.pollTimerId) {
      clearTimeout(this.pollTimerId);
    }
  };

  registerAuthenticator = async (username: string) => {
    try {
      const timeoutSeconds = 120;
      const customNonce = this.getNonce ? this.getNonce() : null;
      const nonce = customNonce ?? uuidv4().replace(/-/g, "");

      const payload = {
        username,
        nonce,
        ...this.preferences?.register.authenticator
      };

      document
        .querySelector(`.${styles.authNotice}`)
        ?.classList.remove(styles.hidden);
      this.showPopup("Loading QR Code...", false);

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

      console.log("Register response:", response.text);

      const body = await response.json();

      if (response.status >= 400) {
        const errorMessage =
          body.errorMessage || "An unknown error has occurred";
        this.hideLoading();
        document
          .querySelector(`#register .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#register .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;

        this.closeModal();

        this.updateMessage(errorMessage, "danger");
        this.hidePopup();
        throw new Error(errorMessage);
      }

      console.log(body);

      const qrCode = kjua({
        text: this.processLink(body.qr_code_data, isIOS()),
        rounded: 10,
        back: "#202020",
        fill: "#2cb2b5"
      });

      const popupQRCode = document.querySelector(`.${styles.qrCodeImg}`);
      if (popupQRCode) {
        popupQRCode?.classList.remove(styles.hidden);
        popupQRCode?.setAttribute("src", qrCode.src);

        if (popupQRCode.parentElement) {
          popupQRCode.parentElement.dataset.link = this.processLink(
            body.qr_code_data,
            isIOS()
          );
        }
      }

      document
        .querySelectorAll(`a.${styles.mobileUsernamelessBtn}`)
        ?.forEach(btn =>
          btn?.setAttribute(
            "href",
            this.processLink(body.qr_code_data, isIOS())
          )
        );

      const mobileQRCode = $(`.${styles.qrCodeMobile}`) as HTMLElement;

      if (mobileQRCode) {
        mobileQRCode.dataset.link = this.processLink(
          body.qr_code_data,
          isIOS()
        );
      }

      this.showPopup("Loading QR Code...", true);
      this.updateMessage(
        isMobile()
          ? "Please accept the request using the app"
          : "Please scan the QR Code with your phone"
      );
      this.showPopupQRCode(false);

      this.getEnrollmentStatus({
        id: body.user_id,
        pollDuration: 2000,
        expirationDate: Date.now() + timeoutSeconds * 1000
      });
    } catch (err) {
      console.error(err);
      throw err;
    }
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
      const customNonce = this.getNonce ? this.getNonce() : null;
      const nonce = customNonce ?? uuidv4().replace(/-/g, "");

      this.showPopup("Please check your email", true);

      if (
        !username ||
        !/^\w+([\.\+-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(username)
      ) {
        const errorMessage = "Please specify a valid email";
        this.hideLoading();
        container!.classList.add(styles.invalid);
        inputErrorMessage!.textContent = errorMessage;

        this.closeModal();

        return;
      }

      if (pushNotice && autharmorIcon) {
        pushNotice.textContent =
          "We've sent a registration email to the address you specified";
        autharmorIcon.src = emailIcon;
      }

      const payload = {
        ...this.preferences?.register.magicLink,
        nonce,
        email_address: username,
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
        this.hideLoading();
        document
          .querySelector(`#register .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#register .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;

        this.closeModal();

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
    const customNonce = this.getNonce ? this.getNonce() : null;
    const nonce = customNonce ?? uuidv4().replace(/-/g, "");

    try {
      const payload = {
        username,
        webauthn_client_id: this.webauthnClientId,
        nonce
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
        this.hideLoading();
        document
          .querySelector(`#register .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#register .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;

        this.closeModal();
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
        id: startBody.registration_id,
        username
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
    const customNonce = this.getNonce ? this.getNonce() : null;
    const nonce = customNonce ?? uuidv4().replace(/-/g, "");

    if (!pushNotice || !qrCodeBtn) {
      throw new Error("DOM was unexpectedly modified");
    }

    pushNotice.textContent = "Attestation in progress";
    qrCodeBtn.textContent = "Click here to scan a QR code instead";
    this.showPopup("Authenticating with WebAuthn", true);

    try {
      const payload = {
        username,
        nonce,
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
        this.hideLoading();
        document
          .querySelector(`#login .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#login .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;

        this.closeModal();
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

      this.executeEvent("authSuccess", {
        ...finishBody,
        auth_method: "WebAuthn",
        id: startBody?.auth_request_id,
        token: finishBody?.auth_validation_token
      });

      this.updateMessage("Authenticated successfully!", "success");
      this.hidePopup(2000);
    } catch (err) {
      this.updateMessage(err.message, "danger");
      this.hidePopup(2000);
    }
  };

  private getRecaptchaToken = async (
    action: string,
    tries = 0
  ): Promise<string> => {
    try {
      console.log("this.recaptchaSiteKey:", this.recaptchaSiteKey);

      if (!this.recaptchaSiteKey || tries >= 3) {
        return "";
      }

      console.log("Loading Recaptcha...");

      if (!this.recaptcha) {
        this.recaptcha = await load(this.recaptchaSiteKey, {
          useEnterprise: true
        });
      }

      console.log("this.recaptcha:", this.recaptcha);

      const token = await this.recaptcha.execute(action);

      console.log("token:", token);

      return token;
    } catch (err) {
      return this.getRecaptchaToken(action, tries + 1);
    }
  };

  onLinkClick = (e: MouseEvent) => {
    const link = (e.target as HTMLAnchorElement).href;
    const now = new Date().valueOf();

    if (isIOS()) {
      // const newTab = window.open(link, "_blank");
      // setTimeout(() => {
      //   console.log(newTab);
      //   // if (newTab) {
      //   //   // if (new Date().valueOf() - now > 100) {
      //   //   //   newTab.close(); // scenario #4
      //   //   //   // old way - "return" - but this would just leave a blank page in users browser
      //   //   //   //return;
      //   //   // }
      //   //   // const message =
      //   //   //   "AuthArmor app is not installed in your phone, would you like to download it from the App Store?";
      //   //   // if (window.confirm(message)) {
      //   //   //   newTab.location.href =
      //   //   //     "https://apps.apple.com/us/app/auth-armor-authenticator/id1502837764";
      //   //   //   return;
      //   //   }
      //   // }
      // }, 50);
    }
  };

  // Authentication
  public requestAuth = async (
    type: AuthTypes,
    options?: Partial<Preferences>
  ): Promise<void> => {
    try {
      this.showLoading();
      this.hasCalledValidate = false;
      const customNonce = this.getNonce ? this.getNonce() : null;
      const nonce = customNonce ?? uuidv4().replace(/-/g, "");

      const parsedType: Record<AuthTypes, keyof FormAuthTypePreferences> = {
        "magiclink-email": "magicLink",
        push: "authenticator",
        webauthn: "webauthn",
        usernameless: "authenticator"
      };
      const token = await this.getRecaptchaToken("auth");

      const payload = {
        ...this.preferences?.auth[parsedType[type]],
        ...options,
        use_visual_verify: this.visualVerify,
        authentication_redirect_url:
          type === "magiclink-email" ? this.authenticationRedirectUrl : null,
        send_push: type === "push",
        nonce,
        google_v3_recaptcha_token: token
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
          type === "magiclink-email" ? "magiclink" : "authenticator"
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
        this.hideLoading();
        document
          .querySelector(`#login .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#login .${styles.inputErrorMessage}`
        )!.textContent = errorMessage;

        this.closeModal();

        this.updateMessage(errorMessage, "danger");
        this.hidePopup();
        return;
      }

      if (body.qr_code_data) {
        const qrCode = kjua({
          text: this.processLink(body.qr_code_data, isIOS()),
          rounded: 10,
          back: "#202020",
          fill: "#2cb2b5"
        });
        const popupQRCode = document.querySelector(`.${styles.qrCodeImg}`);
        popupQRCode?.classList.remove(styles.hidden);
        popupQRCode?.setAttribute("src", qrCode.src);
        document
          .querySelectorAll(`.${styles.mobileUsernamelessBtn}`)
          .forEach(btn =>
            btn.setAttribute(
              "href",
              this.processLink(body.qr_code_data, isIOS())
            )
          );

        if (isIOS()) {
          this.showPopupQRCode(false);
        }

        if (popupQRCode?.parentElement) {
          popupQRCode.parentElement.dataset.link = this.processLink(
            body.qr_code_data,
            isIOS()
          );
        }

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
              this.processLink(body.qr_code_data, isIOS())
            );

          document
            .querySelectorAll<HTMLAnchorElement>(
              `.${styles.mobileUsernamelessBtn}`
            )
            .forEach(link => {
              link.removeEventListener("click", this.onLinkClick);

              link.addEventListener("click", this.onLinkClick);
            });

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
      if (type !== "magiclink-email") {
        this.getRequestStatus({
          id: body.auth_request_id,
          token: body.auth_validation_token,
          pollDuration: 1000,
          usernameless: type === "usernameless"
        });
      }
      this.hideLoading();
    } catch (err) {
      console.error(err);
      this.hideLoading();
      document
        .querySelector(`.${styles.criticalError}`)!
        .classList.remove(styles.hidden);
      this.updateMessage("An unknown error has occurred", "danger");
      this.hidePopup();
    }
  };

  private selectAuthMethod = (
    type: AuthTypes,
    options: Partial<Preferences> = {}
  ): void => {
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
      qrCodeBtn.textContent = isMobile()
        ? "Tap here to launch request in app"
        : "Didn't get the push notification? Click here to scan a QR code instead";
    }

    if (type === "magiclink-email") {
      pushNotice.textContent = "We've sent a magic link to your email";
      qrCodeBtn.textContent = isMobile()
        ? "Tap here to launch request in app"
        : "Didn't get the magic link? Click here to scan a QR code instead";
      this.showPopup("Please check your email", true);
    }

    if (type === "webauthn") {
      pushNotice.textContent = "Assertion in progress";
      qrCodeBtn.textContent = "Click here to scan a QR code instead";
      this.closeModal();
      this.showPopup("Please complete assertion", true);
      this.loginWebAuthn(email.value);
      return;
    }

    if (type === "push") {
      this.showPopup(options?.custom_message, false);
    }

    this.closeModal();

    this.requestAuth(type, { username: email.value, ...options });
  };

  setCardText = (
    messages: Record<string, string>,
    enrolledMethods?: Record<string, any>
  ) => {
    Object.entries(messages).map(([key, value]) => {
      if (key === "title" && document.querySelector(`.${styles.modalHeader}`)) {
        document.querySelector(`.${styles.modalHeader}`)!.textContent = value;
        return value;
      }
      if (document.querySelector(`[data-card="${key}"] .${styles.text}`)) {
        document.querySelector(
          `[data-card="${key}"] .${styles.text}`
        )!.textContent = value;
      }

      if (
        enrolledMethods &&
        document.querySelector(`[data-card="${key}"] .${styles.devices}`)
      ) {
        const parsedKey = key === "push" ? "authenticator" : key;
        document.querySelector(
          `[data-card="${key}"] .${styles.devices}`
        )!.textContent =
          enrolledMethods[parsedKey]?.auth_method_masked_info ?? "";
      }
    });
  };

  mount = async (
    selector = "",
    options: FormMountOptions = defaultOptions
  ): Promise<void> => {
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

    this.visualVerify = parsedOptions.visualVerify ?? false;

    const defaultRegisterPreferences = {
      action_name: "Register",
      short_msg: "Register pending - please authorize",
      timeout_in_seconds: 60
    };

    const defaultLoginPreferences = {
      action_name: "Login",
      short_msg: "Login pending - please authorize",
      timeout_in_seconds: 60
    };

    const parsedPreferences: FormPreferences = {
      register: {
        magicLink: {
          ...defaultRegisterPreferences,
          timeout_in_seconds: 300,
          ...(options.preferences?.register?.default ?? {}),
          ...(options.preferences?.register?.magicLink ?? {})
        },
        authenticator: {
          ...defaultRegisterPreferences,
          timeout_in_seconds: 90,
          ...(options.preferences?.register?.default ?? {}),
          ...(options.preferences?.register?.authenticator ?? {})
        },
        webauthn: {
          ...defaultRegisterPreferences,
          timeout_in_seconds: 120,
          ...(options.preferences?.register?.default ?? {}),
          ...(options.preferences?.register?.webauthn ?? {})
        }
      },
      auth: {
        magicLink: {
          ...defaultLoginPreferences,
          timeout_in_seconds: 300,
          ...(options.preferences?.auth?.default ?? {}),
          ...(options.preferences?.auth?.magicLink ?? {})
        },
        authenticator: {
          ...defaultLoginPreferences,
          timeout_in_seconds: 90,
          ...(options.preferences?.auth?.default ?? {}),
          ...(options.preferences?.auth?.authenticator ?? {})
        },
        webauthn: {
          ...defaultLoginPreferences,
          timeout_in_seconds: 120,
          ...(options.preferences?.auth?.default ?? {}),
          ...(options.preferences?.auth?.webauthn ?? {})
        }
      }
    };

    this.preferences = parsedPreferences;

    const authenticatorEnabled =
      (!parsedOptions.methods ||
        parsedOptions.methods?.includes("authenticator")) &&
      parsedOptions.usernameless !== false;

    element.innerHTML = `
      <div class="${styles.container}">
        <div class="${styles.content}">
          <div class="${styles.loadingOverlay}">
            <div class="${styles.ldsRing}">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
            <p class="${styles.loadingText}">
              ${this.loadingText[this.textIndex]}
            </p>
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
            <div class="${styles.tab} ${
      parsedOptions.defaultTab === "login" ? styles.activeTab : ""
    }" data-tab="login">
              Login
            </div>
            <div class="${styles.tab} ${
      parsedOptions.defaultTab === "register" ? styles.activeTab : ""
    }" data-tab="register">Register</div>
          </div>
          <form
            id="login"
            class="${styles.tabContent}" 
            style="${
              parsedOptions.defaultTab === "login"
                ? "display: block;"
                : "display: none;"
            } ${!authenticatorEnabled ? "min-height: 164px;" : ""}">
            <div class="${styles.infoContainer}">
              ${
                authenticatorEnabled
                  ? `
                    <p class="${styles.headerText}">
                      Sign in using the Auth Armor Authenticator app
                    </p>
                    ${
                      isMobile()
                        ? `
                            <div class="${styles.mobileUsernameless}">
                              <p class="${styles.mobileUsernamelessTitle}">Usernameless login</p>
                              <a href="#" target="_blank" class="${styles.mobileUsernamelessBtn}">
                                <div class="${styles.mobileUsernamelessIconContainer}">
                                  <img src="${logo}" class="${styles.mobileUsernamelessIcon}" />
                                </div>
                                Login with App
                              </a>
                            </div>
                          `
                        : `
                            <div class="${styles.qrCode}">
                              <img src="" alt="" class="${styles.usernamelessQrImg}">
                              <div class="${styles.qrCodeTimeout} ${styles.hidden}">
                                <div class="${styles.timeoutHead}">Code timed out!</div>
                                <div class="${styles.timeoutBtn}">Refresh Code</div>
                              </div>
                            </div>
                            <p class="${styles.desc}">Scan this QR code using the app to sign in</p>
                          `
                    }
                    <div class="${styles.timerContainer}">
                      <p class="${styles.timer}">00:00</p>
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
          </form>
          <form
            id="register"
            class="${styles.tabContent}" 
            style="${!authenticatorEnabled ? "min-height: 164px;" : ""} ${
      parsedOptions.defaultTab === "register"
        ? "display: block;"
        : "display: none;"
    }">
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
    `;

    document.body.innerHTML += `
      <div class="${styles.modal} ${styles.hidden}">
        <div class="${styles.modalBackground}"></div>
        <div class="${styles.modalContainer}">
          <p class="${styles.modalHeader}">Pick your auth method</p>
          <div class="${styles.cards}">
            ${
              !parsedOptions.methods ||
              parsedOptions.methods?.includes("authenticator")
                ? `
                  <div class="${styles.card}" data-card="push">
                    <div class="${styles.icon}">
                      <img src="${phoneIcon}" alt="icon" />
                    </div>
                    <p class="${styles.title}">Push Authentication</p>
                    <p class="${styles.textContainer}">
                      <span class="${styles.text}">Send me a push message to my Auth Armor authenticator to login</span> <span class="${styles.devices}"></span>
                    </p>
                  </div>
                  `
                : ""
            }

            ${
              !parsedOptions.methods ||
              parsedOptions.methods.includes("magiclink-email")
                ? `
                  <div class="${styles.card} ${styles.email}" data-card="magiclink-email">
                    <div class="${styles.icon}">
                      <img src="${emailIcon}" alt="icon" />
                    </div>
                    <p class="${styles.title}">Magic Link Login Email</p>
                    <p class="${styles.textContainer}">
                      <span class="${styles.text}">Send me a magic link email to login</span> <span class="${styles.devices}"></span>
                    </p>
                  </div>`
                : ""
            }

            ${
              !parsedOptions.methods ||
              parsedOptions.methods.includes("webauthn")
                ? `
                  <div class="${styles.card}" data-card="webauthn">
                    <div class="${styles.icon}">
                      <img src="${emailIcon}" alt="icon" />
                    </div>
                    <p class="${styles.title}">WebAuthn</p>
                    <p class="${styles.textContainer}">
                      <span class="${styles.text}">Login using WebAuthn</span> <span class="${styles.devices}"></span>
                    </p>
                  </div>`
                : ""
            }
          </div>
          <p class="${styles.another}">Choose another method</p>
        </div>
      </div>
    `;

    this.textIndex += 1;

    this.showLoading();

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

          if (
            input.value?.trim() ||
            parsedOptions.methods?.includes("webauthn")
          ) {
            document
              .querySelector(`#login .${styles.btn}`)
              ?.classList.remove(styles.disabled);
            document
              .querySelector(`#register .${styles.btn}`)
              ?.classList.remove(styles.disabled);
          } else {
            document
              .querySelector(`#login .${styles.btn}`)
              ?.classList.add(styles.disabled);
            document
              .querySelector(`#register .${styles.btn}`)
              ?.classList.add(styles.disabled);
          }
        });
      });

    const submitForm = async (btn: HTMLDivElement) => {
      try {
        const modal = document.querySelector(
          `.${styles.modal}`
        ) as HTMLDivElement;
        const loginUsername = document.querySelector(
          `#login .${styles.email}`
        ) as HTMLInputElement;
        const registerUsername = document.querySelector(
          `#register .${styles.email}`
        ) as HTMLInputElement;

        cards.forEach(card => {
          card.classList.remove(styles.hiddenDisplay);
        });

        if (btn.dataset.btn === "login") {
          if (!loginUsername.value) {
            return;
          }

          this.showLoading();

          const enrollments = await this.getUserEnrollments({
            username: loginUsername.value
          });

          if (!enrollments.length) {
            this.hideLoading();
            return;
          }

          const enrolledMethods = {
            authenticator: enrollments.find(
              (enrollment: any) => enrollment.auth_method_id === 4
            ),
            webauthn: enrollments.find(
              (enrollment: any) => enrollment.auth_method_id === 30
            ),
            "magiclink-email": enrollments.find(
              (enrollment: any) => enrollment.auth_method_id === 20
            )
          };

          const availableMethods = Object.entries(enrolledMethods).filter(
            ([, value]) => value
          );

          const messages = {
            title: "Pick your auth method",
            push: enrolledMethods.authenticator?.auth_method_masked_info
              ? `Send a push to:`
              : "Send me a push message to my Auth Armor authenticator to login",
            "magiclink-email": enrolledMethods["magiclink-email"]
              ?.auth_method_masked_info
              ? `Send magiclink email to:`
              : "Send me a magic link email to login",
            webauthn: enrolledMethods.webauthn?.auth_method_masked_info
              ? `Login using WebAuthn my authorized credential(s):`
              : "Login using WebAuthn"
          };

          this.setCardText(messages, enrolledMethods);

          if (parsedOptions.methods?.length === 1) {
            const [method] = parsedOptions.methods ?? [];
            const message = this.getPopupMessage(enrolledMethods[method]);
            if (enrolledMethods[method]) {
              this.selectAuthMethod(
                method === "authenticator" ? "push" : method,
                {
                  custom_message: message
                }
              );
              this.hideLoading();
              return;
            }
          } else if (availableMethods.length === 1) {
            const [method] = availableMethods[0] ?? [];
            const message = this.getPopupMessage(
              enrolledMethods[method as AuthMethods]
            );
            if (method) {
              const parsedMethod: AuthTypes =
                method === "authenticator" ? "push" : (method as AuthTypes);
              this.selectAuthMethod(parsedMethod, {
                custom_message: message
              });
              this.hideLoading();
              return;
            }
          }

          if (
            parsedOptions.methods?.includes("webauthn") &&
            !loginUsername.value
          ) {
            this.selectAuthMethod("webauthn");
            this.hideLoading();
            return;
          }

          cards.forEach(card => {
            const type = card.dataset.card as AuthTypes;
            const parsedType =
              type === "push" || type === "usernameless"
                ? "authenticator"
                : type;

            if (
              (type === "push" && !enrolledMethods.authenticator) ||
              !enrolledMethods[parsedType]
            ) {
              card.classList.add(styles.hiddenDisplay);
              return;
            }

            card.classList.remove(styles.hiddenDisplay);
          });
          this.hideLoading();
        }

        if (btn.dataset.btn === "register") {
          if (!registerUsername.value) {
            return;
          }

          const messages = {
            title: "Pick your registration method",
            push:
              "Send me a push message to my Auth Armor authenticator to register",
            magiclink: "Send me a magic link email to register",
            webauthn: "Register using WebAuthn"
          };

          this.setCardText(messages);

          if (parsedOptions.methods?.length === 1) {
            const [method] = parsedOptions.methods;
            const register: Record<AuthMethods, () => Promise<void>> = {
              "magiclink-email": () =>
                this.registerMagicLink(registerUsername.value),
              webauthn: () => this.registerWebAuthn(registerUsername.value),
              authenticator: () =>
                this.registerAuthenticator(registerUsername.value)
            };

            register[method]();
            this.hideLoading();
            return;
          }
        }

        if (modal) {
          modal.dataset.type = btn.dataset.btn;
          modal.classList.remove(styles.hidden);
        }

        this.hideLoading();
      } catch (err) {
        console.error(err);
        this.hideLoading();
      }
    };

    btns.forEach(btn => {
      btn.addEventListener("click", async function() {
        submitForm(this);
      });
    });

    document.querySelector("#register")?.addEventListener("submit", e => {
      e.preventDefault();
      submitForm($(`#register .${styles.btn}`) as HTMLDivElement);
    });

    document.querySelector("#login")?.addEventListener("submit", e => {
      e.preventDefault();
      submitForm($(`#login .${styles.btn}`) as HTMLDivElement);
    });

    if (modalBg) {
      modalBg.addEventListener("click", this.closeModal);
    }

    cards.forEach(card => {
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
            "magiclink-email": () =>
              this.registerMagicLink(registerUsername.value),
            webauthn: () => this.registerWebAuthn(registerUsername.value),
            push: () => this.registerAuthenticator(registerUsername.value),
            usernameless: () =>
              this.registerAuthenticator(registerUsername.value)
          };

          register[type]();
          this.closeModal();
        }

        if (modal.dataset.type === "custom") {
          this.selectAuthMethod(type, this.customOptions);
        }
      });
    });

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

    const SDKConfig = await this.getSDKConfig();
    console.log(SDKConfig);

    if (SDKConfig.recaptcha.enabled) {
      this.recaptchaSiteKey = SDKConfig.recaptcha.siteId;
    }

    if (authenticatorEnabled) {
      console.log("Getting usernameless data");
      this.requestAuth("usernameless");
      this.tickTimer();
    }

    this.updateModalText();
  };

  getPopupMessage = (method: any) => {
    if (method.auth_method_id === 4) {
      return `Waiting for ${method.auth_method_masked_info ?? "device"}`;
    }
  };

  processLink = (link: string, customScheme: boolean) => {
    const sanitizedLink = new URL(
      link.replace("autharmor.com", "autharmor.dev")
    );

    // if (customScheme) {
    //   const moduleName = sanitizedLink.hostname.startsWith("auth.")
    //     ? "usernameless"
    //     : "profile";
    //   const [profileId, requestId] = sanitizedLink.pathname
    //     .split("/")
    //     .slice(-2);
    //   return `autharmordev://${moduleName}/${profileId}/${requestId}`;
    // }

    return sanitizedLink.toString();
  };

  setStyle = (styles: FormStyles): void => {
    const cssVariables: { [x: string]: string } = {
      accentColor: "--autharmor-accent-color",
      backgroundColor: "--autharmor-background-color",
      tabColor: "--autharmor-tab-color",
      qrCodeBackground: "--autharmor-qr-code-background",
      highlightColor: "--autharmor-highlight-color",
      inputBackground: "--autharmor-input-background",
      appBtn: "--autharmor-app-btn"
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

  // -- Authentication functionality

  public getUserEnrollments = async ({ username }: { username: string }) => {
    const userId = "00000000-0000-0000-0000-000000000000";

    if (!username) {
      return [];
    }

    const data = await this.fetch(
      `${this.debug.url}/api/v3/users/${userId}/enrolledmethods?apikey=${this.publicKey}`,
      {
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          username_or_email_address: username
        })
      }
    )
      .then(res => {
        if (res.status >= 400) {
          throw res;
        }

        return res.json();
      })
      .catch(() => {
        document
          .querySelector(`#login .${styles.inputContainer}`)!
          .classList.add(styles.invalid);
        document.querySelector(
          `#login .${styles.inputErrorMessage}`
        )!.textContent = "User doesn't exist";
      });

    return data?.enrolled_auth_methods ?? [];
  };

  private authenticate = async (options?: Partial<Preferences>) => {
    try {
      const modal = document.querySelector(
        `.${styles.modal}`
      ) as HTMLDivElement;

      this.customOptions = options;

      modal.dataset.type = "custom";
      modal.classList.remove(styles.hidden);
    } catch (err) {
      console.error(err);
      this.hidePopup();
      throw err?.data ?? err;
    }
  };

  public destroy = () => {
    if (this.QRAnimationTimer) {
      clearTimeout(this.QRAnimationTimer);
    }

    if (this.tickTimerId) {
      clearTimeout(this.tickTimerId);
    }

    if (this.pollTimerId) {
      clearTimeout(this.pollTimerId);
    }
  };

  // Public interfacing SDK functions

  get auth() {
    return {
      authenticate: this.authenticate
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

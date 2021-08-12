import Axios, { AxiosResponse } from "axios";
// @ts-ignore
import kjua from "kjua";
import config from "./config/index";
import qrCode from "./assets/qr-code.svg";
import logo from "./assets/logo.png";
import closeIcon from "./assets/cancel.svg";

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
  | "error";

type EventListener = (...data: any) => void | Promise<void>;

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
  timeout: number;
}

interface AuthenticateWebsocketSuccess {
  data: {
    response: any;
    nickname: string;
    token: string;
    authorized: true;
  };
  /* Custom response received from auth server */
  metadata: any;
}

interface AuthenticateWebsocketFail {
  data: {
    response: any;
    nickname: string;
    authorized: false;
  };
  /* Custom response received from auth server */
  metadata: any;
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
  qrCodeStyle: {
    borderRadius: number;
    background: string;
    foreground: string;
  };
  locationData: LocationData;
  onSuccess: (data: AuthenticateWebsocketSuccess) => any;
  onFailure: (data: AuthenticateWebsocketFail) => any;
}

declare global {
  interface Window {
    AuthArmorSDK: any;
    AuthArmor: any;
  }
}

const $ = (selectors: string) => document.querySelector(selectors);

class SDK {
  private url: string;
  private events: Events[];
  private eventListeners: Map<Events, EventListener[]>;
  private socket: WebSocket | undefined;
  private requestCompleted: boolean = false;

  constructor({ url = "", pathPrefix = "/auth/autharmor", polling = false }) {
    this.url = this.processUrl(url) + this.processUrl(pathPrefix);
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
      "error"
    ];
    this.eventListeners = new Map<Events, EventListener[]>(
      // @ts-ignore
      Object.entries(
        this.events.reduce(
          (eventListeners, eventName) => ({
            ...eventListeners,
            [eventName]: []
          }),
          {}
        )
      )
    );

    window.AuthArmor = {};
    this.init = this.init.bind(this);
    this.init({ polling });
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
    const popupOverlay = document.querySelector(".popup-overlay");
    const authMessage = document.querySelector(".auth-message-text");
    const showQRCodeBtn = document.querySelector(".show-popup-qrcode-btn");
    const hideQRCodeBtn = document.querySelector(".hide-popup-qrcode-btn");

    if (hideQRBtn) {
      showQRCodeBtn?.classList.add("hidden");
      hideQRCodeBtn?.classList.add("hidden");
    }

    if (!hideQRBtn) {
      showQRCodeBtn?.classList.remove("hidden");
      hideQRCodeBtn?.classList.add("hidden");
    }

    if (popupOverlay) {
      popupOverlay.classList.remove("hidden");
    }

    if (authMessage) {
      authMessage.textContent = message;
    }

    this.executeEvent("popupOverlayOpened");
  };

  private hidePopup = (delay = 2000) => {
    setTimeout(() => {
      const authMessage = document.querySelector(".auth-message");
      const authMessageText = document.querySelector(".auth-message-text");
      const popupOverlay = document.querySelector(".popup-overlay");

      if (popupOverlay) {
        popupOverlay.classList.add("hidden");
      }

      if (authMessage) {
        authMessage.setAttribute("class", "auth-message");
        this.executeEvent("popupOverlayClosed");
        setTimeout(() => {
          if (authMessageText) {
            authMessageText.textContent = "Waiting for device";
          }
        }, 200);
      }
    }, delay);
  };

  private updateMessage = (message: string, status: string = "success") => {
    const authMessage = document.querySelector(".auth-message");
    const authMessageText = document.querySelector(".auth-message-text");
    if (authMessage && authMessageText) {
      authMessage.classList.add(`autharmor--${status}`);
      authMessageText.textContent = message;
    }
  };

  private executeEvent = (eventName: Events, ...data: any[]) => {
    this.ensureEventExists(eventName);

    const listeners = this.eventListeners.get(eventName);
    listeners?.map(listener => listener(...data));
  };

  private init({ polling = false }) {
    document.body.innerHTML += `
      <style>
        .autharmor--danger {
          background-color: #f55050 !important;
        }

        .autharmor--warn {
          background-color: #ff8d18 !important;
        }

        .popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background-color: rgba(53, 57, 64, 0.98);
          z-index: 100;
          opacity: 1;
          visibility: visible;
          transition: all .2s ease;
        }

        .popup-overlay * {
          box-sizing: border-box;
        }

        .close-popup-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          top: -15px;
          right: -15px;
          width: 35px;
          height: 35px;
          border-radius: 100px;
          background-color: #545d6d;
          /* transform: translate(-50%, -50%); */
          cursor: pointer;
        }

        .close-popup-btn img {
          width: 15px;
        }

        .close-popup-btn:hover {
          background-color: #d23b3b;
        }
        
        .popup-overlay-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-radius: 15px;
          box-shadow: 0px 20px 50px rgba(0, 0, 0, 0.15);
          background-color: #2b313c;
          width: 90%;
          max-width: 480px;
          min-width: 300px;
        }

        .hide-popup-qrcode-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          right: 20px;
          top: 15px;
          padding: 6px 10px;
          border-radius: 100px;
          background-color: transparent;
          cursor: pointer;
          transition: all .2s ease;
        }

        .hide-popup-qrcode-btn:hover {
          background-color: rgba(255,255,255,0.1);
        }

        .hide-popup-qrcode-btn img {
          margin-right: 6px;
          height: 20px;
        }

        .show-popup-qrcode-btn {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          background-color: rgba(255,255,255,0.2);
          padding: 0 7px;
          height: 35px;
          color: rgba(255,255,255,0.7);
          font-size: 12px;
          border-radius: 0 0 15px 15px;
          cursor: pointer;
          transition: all .2s ease;
        }

        .show-popup-qrcode-btn:hover {
          color: rgba(255,255,255,1);
        }

        .show-popup-qrcode-btn.hidden {
          height: 0;
          color: transparent;
        }

        .qrcode-btn-text {
          margin: 0;
          font-family: "Montserrat", sans-serif;
        }

        .popup-qrcode-btn-text {
          margin: 0;
          font-size: 12px;
          font-family: 'Montserrat', 'Helvetica Neue', 'Roboto', 'Arial', sans-serif;
          color: white;
          opacity: 0.8;
          font-weight: bold;
        }

        .popup-content-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          width: 100%;
          height: 100%;
        }

        .qr-code-img-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: scale(1) translate(-50%, -50%);
          transform-origin: top left;
          pointer-events: none;
          transition: all .3s ease;
        }

        img.qr-code-img {
          height: 130px;
          margin-bottom: 10px;
        }

        .qr-code-img-desc {
          font-size: 12px;
          font-family: 'Montserrat', 'Helvetica Neue', 'Roboto', 'Arial', sans-serif;
          font-weight: bold;
          margin: 0;
          color: white;
          opacity: 0.8;
          margin-bottom: -10px;
          text-align: center;
        }
        
        .popup-overlay .autharmor-icon {
          position: relative;
          height: 130px;
          margin-bottom: 40px;
          margin-top: 40px;
          pointer-events: none;
          transition: all .3s ease;
          z-index: 2;
        }
        
        .popup-overlay .auth-message {
          display: flex;
          align-items: baseline;
          justify-content: center;
          margin: 0;
          font-weight: bold;
          color: white;
          font-size: 18px;
          padding: 14px 80px;
          border-radius: 0;
          background-color: #2cb2b5;
          width: 100%;
          text-align: center;
          font-family: 'Montserrat', 'Helvetica Neue', 'Roboto', 'Arial', sans-serif;
          transition: all .2s ease;
        }

        .popup-overlay .auth-message.rounded {
          border-radius: 0 0 10px 10px;
        }

        .hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .qr-code-img-container.hidden {
          transform: scale(0) translate(-50%, -50%);
          opacity: 0;
          visibility: hidden;
        }

        .autharmor-icon.hidden {
          transform: scale(0.3) translateY(-70px);
          /* filter: grayscale(1); */
          opacity: 1;
          visibility: visible;
        }

        p.push-notice {
          margin: 0;
          font-size: 14px;
          font-family: "Montserrat", sans-serif;
          color: #ffffffa8;
          margin-top: 12px;
          transition: all .2s ease;
        }

        .pulse {
            display: block;
            width: 10px;
            height: 10px;
            margin-left: 14px;
            border-radius: 50%;
            background: #ffffff61;
            cursor: pointer;
            box-shadow: 0 0 0 rgba(255,255,255,.4);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(255,255,255,.4)
            }

            70% {
                box-shadow: 0 0 0 10px rgba(255,255,255,0)
            }

            100% {
                box-shadow: 0 0 0 0 rgba(255,255,255,0)
            }
        }
      </style>
      <div class="popup-overlay hidden">
        <div class="popup-overlay-content">
          <div class="popup-content-container">
            <div class="close-popup-btn">
              <img src="${closeIcon}" alt="Close Popup Button" />
            </div>
            <div class="hide-popup-qrcode-btn hidden">
              <img src="${qrCode}" alt="QR Code Button" />
              <p class="popup-qrcode-btn-text">Hide QR Code</p>
            </div>
            <p class="push-notice">We've sent a push message to your device(s)</p>
            <img src="${logo}" alt="AuthArmor Icon" class="autharmor-icon" />
            <div class="qr-code-img-container hidden">
              <img src="" alt="QR Code" class="qr-code-img" />
              <p class="qr-code-img-desc">Please scan the code with the AuthArmor app</p>
            </div>
          </div>
          <div class="auth-message"><span class="auth-message-text">Authenticating with AuthArmor...</span><span class="pulse"></span></div>
          <div class="show-popup-qrcode-btn">
            <p class="qrcode-btn-text">Didn't get the push notification? Click here to scan a QR code instead</p>
          </div>
        </div>
      </div>
    `;

    const popup = $(".popup-overlay");
    const showPopupBtn = $(".show-popup-qrcode-btn");
    const hidePopupBtn = $(".hide-popup-qrcode-btn");
    const authMessage = $(".auth-message");
    const qrCodeContainer = $(".qr-code-img-container");
    const autharmorIcon = $(".autharmor-icon");
    const pushNotice = $(".push-notice");
    const closePopupBtn = $(".close-popup-btn");
    let timer: NodeJS.Timeout;

    showPopupBtn?.addEventListener("click", () => {
      clearTimeout(timer);
      showPopupBtn?.classList.add("hidden");
      autharmorIcon?.classList.add("hidden");
      timer = setTimeout(() => {
        qrCodeContainer?.classList.remove("hidden");
        hidePopupBtn?.classList.remove("hidden");
        authMessage?.classList.add("rounded");
        pushNotice?.classList.add("hidden");
      }, 200);
    });

    hidePopupBtn?.addEventListener("click", () => {
      clearTimeout(timer);
      hidePopupBtn?.classList.add("hidden");
      qrCodeContainer?.classList.add("hidden");
      timer = setTimeout(() => {
        autharmorIcon?.classList.remove("hidden");
        showPopupBtn?.classList.remove("hidden");
        authMessage?.classList.remove("rounded");
        pushNotice?.classList.remove("hidden");
      }, 200);
    });

    closePopupBtn?.addEventListener("click", () => {
      clearTimeout(timer);
      popup?.classList.add("hidden");
      hidePopupBtn?.classList.add("hidden");
      qrCodeContainer?.classList.add("hidden");
      autharmorIcon?.classList.remove("hidden");
      showPopupBtn?.classList.remove("hidden");
    });

    if (!polling) {
      this.socket = new WebSocket(
        (this.url + "/socket").replace(/^http/gi, "ws")
      );

      const timer = setInterval(() => {
        if (this.socket) {
          this.socket.send(`1`);
          return;
        }

        clearInterval(timer);
      }, 25000); // Keep websocket connection alive
    }

    window.AuthArmor.openedWindow = () => {
      this.executeEvent("inviteWindowOpened");
      this.showPopup();
      this.requestCompleted = false;
    };

    window.addEventListener("message", message => {
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
    });

    window.AuthArmor.closedWindow = () => {
      this.executeEvent("inviteWindowClosed");

      if (!this.requestCompleted) {
        this.updateMessage("User closed the popup", "danger");
      }

      this.hidePopup();
    };
  }

  // ---- Public Methods

  // -- Event Listener functions

  on(eventName: Events, fn: EventListener) {
    this.ensureEventExists(eventName);

    const listeners = this.eventListeners.get(eventName) ?? [];
    this.eventListeners.set(eventName, [...listeners, fn]);
  }

  off(eventName: Events) {
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
    referenceId
  }: InviteOptions) => {
    try {
      if (!nickname) {
        throw new Error("Please specify a nickname for the invite code");
      }

      const { data } = await Axios.post(
        `/invite`,
        {
          nickname,
          referenceId
        },
        { withCredentials: true }
      );

      return {
        ...data,
        getQRCode: ({
          backgroundColor = "#202020",
          fillColor = "#2cb2b5",
          borderRadius = 0
        } = {}) => {
          const stringifiedInvite = data.data.qr_code_data;
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
      throw err?.response?.data;
    }
  };

  private confirmInvite = async (nickname: string) => {
    try {
      this.executeEvent("authenticating");
      this.showPopup();
      const { data } = await Axios.post(
        `/invite/confirm`,
        {
          nickname
        },
        { withCredentials: true }
      );

      if (data.response_message === "Timeout") {
        this.updateMessage("Authentication request timed out", "warn");
        this.hidePopup();
        throw data;
      }

      if (data.response_message === "Success") {
        this.updateMessage("Authentication request approved!", "success");
        this.hidePopup();
        return data;
      }

      if (data.response_message === "Declined") {
        this.updateMessage("Authentication request declined", "danger");
        this.hidePopup();
        throw data;
      }

      this.hidePopup();
      return data;
    } catch (err) {
      this.updateMessage(
        err?.response?.data.errorMessage ?? "An error has occurred",
        "danger"
      );
      this.hidePopup();
      throw err?.response?.data
        ? err?.response?.data.errorMessage ?? {
            errorCode: 400,
            errorMessage: "An unknown error has occurred"
          }
        : err;
    }
  };

  private logout = async () => {
    try {
      const { data } = await Axios.get(`/logout`, {
        withCredentials: true
      });
      return data;
    } catch (err) {
      throw err?.response?.data;
    }
  };

  // -- Authentication functionality

  private authenticate = async ({
    nickname,
    sendPush = true,
    visualVerify = false,
    showPopup = true,
    actionName,
    shortMessage,
    locationData,
    qrCodeStyle = {
      borderRadius: 10,
      background: "#202020",
      foreground: "#2cb2b5"
    },
    onSuccess,
    onFailure
  }: AuthenticateArgs) => {
    try {
      const { data }: AxiosResponse<AuthRequest> = await Axios.post(
        `/authenticate`,
        {
          nickname,
          send_push: sendPush && nickname?.length > 0,
          use_visual_verify: visualVerify,
          action_name: actionName,
          short_msg: shortMessage,
          origin_location_data: locationData
        },
        { withCredentials: true }
      );
      if (showPopup === true || (sendPush && showPopup !== false)) {
        const qrCode = kjua({
          text: data.authRequest.qr_code_data,
          rounded: qrCodeStyle?.borderRadius ?? 10,
          back: qrCodeStyle?.background ?? "#202020",
          fill: qrCodeStyle?.foreground ?? "#2cb2b5"
        }).src;
        const qrCodeImage = $(".qr-code-img");
        qrCodeImage?.setAttribute("src", qrCode);
        this.showPopup();
      }

      if (this.socket) {
        this.socket.send(
          JSON.stringify({
            event: "subscribe:auth",
            data: {
              id: data.authRequest.auth_request_id,
              requestToken: data.requestToken
            }
          })
        );

        this.socket.onmessage = event => {
          try {
            const parsedData = JSON.parse(event.data);
            if (parsedData.event === "auth:response") {
              if (
                parsedData.data.response?.auth_response.response_message ===
                "Success"
              ) {
                this.updateMessage(
                  "Authentication request approved!",
                  "success"
                );
                onSuccess?.({
                  data: parsedData.data,
                  metadata: parsedData.metadata
                });
              }

              if (
                parsedData.data.response?.auth_response.response_message ===
                "Timeout"
              ) {
                this.updateMessage("Authentication request timed out", "warn");
                onFailure?.({
                  data: parsedData.data,
                  metadata: parsedData.metadata
                });
              }

              if (
                parsedData.data.response?.auth_response.response_message ===
                "Declined"
              ) {
                this.updateMessage("Authentication request declined", "danger");
                onFailure?.({
                  data: parsedData.data,
                  metadata: parsedData.metadata
                });
              }

              this.hidePopup();
            }
          } catch (err) {
            console.error(err);
          }
        };
      }

      return {
        ...data,
        getTimeLeft: () => data.timeout - Date.now(),
        getQRCode: () =>
          kjua({
            text: data.authRequest.qr_code_data,
            rounded: qrCodeStyle?.borderRadius ?? 10,
            back: qrCodeStyle?.background ?? "#202020",
            fill: qrCodeStyle?.foreground ?? "#2cb2b5"
          }).src
      };
    } catch (err) {
      console.error(err);
      this.hidePopup();
      throw err?.response?.data;
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
      throw err?.response?.data;
    }
  };

  // Public interfacing SDK functions

  get invite() {
    return {
      generateInviteCode: this.generateInviteCode,
      setInviteData: this.setInviteData,
      confirmInvite: this.confirmInvite
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
}

window.AuthArmorSDK = SDK;

export default SDK;

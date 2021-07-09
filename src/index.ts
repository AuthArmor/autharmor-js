import Axios, { AxiosResponse } from "axios";
// @ts-ignore
import kjua from "kjua";
import config from "./config/index";
import images from "./assets/images.json";

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
  auth_request_id: string;
  auth_profile_id: string;
  visual_verify_value: string;
  response_code: number;
  response_message: string;
  qr_code_data: string;
  push_message_sent: boolean;
}

type AuthCallback = (response: any) => any | Promise<any>;

declare global {
  interface Window {
    AuthArmor: any;
  }
}

class AuthArmorSDK {
  url: string;
  inviteCode: string = "";
  signature: string = "";
  events: Events[];
  eventListeners: Map<Events, EventListener[]>;
  socket: WebSocket | undefined;
  requestCompleted: boolean = false;
  onAuthSuccess: AuthCallback = () => {};
  onAuthFailed: AuthCallback = () => {};

  constructor({ url = "", polling = false }) {
    this.url = this.processUrl(url);
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

  private showPopup = (message = "Waiting for device") => {
    const popupOverlay = document.querySelector(".popup-overlay");
    const authMessage = document.querySelector(".auth-message");

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
      const popupOverlay = document.querySelector(".popup-overlay");

      if (popupOverlay) {
        popupOverlay.classList.add("hidden");
      }

      if (authMessage) {
        authMessage.setAttribute("class", "auth-message");
        this.executeEvent("popupOverlayClosed");
        setTimeout(() => {
          authMessage.textContent = "Waiting for device";
        }, 200);
      }
    }, delay);
  };

  private updateMessage = (message: string, status = "success") => {
    const authMessage = document.querySelector(".auth-message");
    if (authMessage) {
      authMessage.classList.add(`autharmor--${status}`);
      authMessage.textContent = message;
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
        
        .popup-overlay-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0px 20px 50px rgba(0, 0, 0, 0.15);
          background-color: #2b313c;
          width: 90%;
          max-width: 480px;
          min-width: 300px;
        }
        
        .popup-overlay img {
          height: 110px;
          margin-bottom: 40px;
          margin-top: 40px;
        }
        
        .popup-overlay p {
          margin: 0;
          font-weight: bold;
          color: white;
          font-size: 18px;
          padding: 14px 80px;
          background-color: rgb(0, 128, 128);
          width: 100%;
          text-align: center;
          font-family: 'Montserrat', 'Helvetica Neue', 'Roboto', 'Arial', sans-serif;
          transition: all .2s ease;
        }

        .hidden {
          opacity: 0;
          visibility: hidden;
        }
      </style>
      <div class="popup-overlay hidden">
        <div class="popup-overlay-content">
          <img src="${images.logo}" alt="AuthArmor Icon" />
          <p class="auth-message">Authenticating with AuthArmor...</p>
        </div>
      </div>
    `;

    if (!polling) {
      this.socket = new WebSocket(this.url);
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

    if (inviteCode !== undefined) {
      this.inviteCode = inviteCode;
    }

    if (signature !== undefined) {
      this.signature = signature;
    }

    return {
      getQRCode: ({
        backgroundColor = "#202020",
        fillColor = "#2db4b4",
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
        `/auth/autharmor/invite`,
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
          fillColor = "#2db4b4",
          borderRadius = 0
        } = {}) => {
          const stringifiedInvite = JSON.stringify({
            type: "profile_invite",
            payload: data
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
          return `${config.inviteURL}/?i=${data.invite_code}&aa_sig=${data.aa_sig}`;
        },
        openInviteLink: () => {
          this.showPopup();
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
        `/auth/autharmor/invite/confirm`,
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
      const { data } = await Axios.get(`/auth/autharmor/logout`, {
        withCredentials: true
      });
      return data;
    } catch (err) {
      throw err?.response?.data;
    }
  };

  // -- Authentication functionality

  private authenticate = async (nickname: string) => {
    try {
      this.showPopup();
      const { data }: AxiosResponse<AuthRequest> = await Axios.post(
        `/auth/autharmor/auth`,
        {
          nickname
        },
        { withCredentials: true }
      );

      if (this.socket) {
        this.socket.send(
          JSON.stringify({
            event: "subscribe:auth",
            data: {
              id: data.auth_request_id
            }
          })
        );

        this.socket.onmessage = event => {
          try {
            const parsedData = JSON.parse(event.data);
            if (parsedData.event === "auth:response") {
              if (parsedData.data.response_message === "Success") {
                this.updateMessage(
                  "Authentication request approved!",
                  "success"
                );
                this.onAuthSuccess(parsedData.data);
              }

              if (parsedData.data.response_message === "Timeout") {
                this.updateMessage("Authentication request timed out", "warn");
                this.onAuthFailed(parsedData.data);
              }

              if (parsedData.data.response_message === "Declined") {
                this.updateMessage("Authentication request declined", "danger");
                this.onAuthFailed(parsedData.data);
              }

              this.hidePopup();
            }
          } catch (err) {
            console.error(err);
          }
        };
      }

      return data;
    } catch (err) {
      console.error(err);
      this.hidePopup();
      throw err?.response?.data;
    }
  };

  // Get if user is authenticated
  private getUser = async () => {
    try {
      const { data } = await Axios.get(`/auth/autharmor/me`, {
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

export default AuthArmorSDK;

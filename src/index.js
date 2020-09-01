import Axios from "axios";
import kjua from "kjua";
import config from "./config/index";
import images from "./assets/images.json";

class AuthArmorSDK {
  constructor(url) {
    this.url = this._processUrl(url);
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
    this.eventListeners = new Map(
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

    this.inviteCode = "";
    this.signature = "";
    this._init = this._init.bind(this);
    this._init();
  }

  // Private Methods

  _processUrl = (url = "") => {
    const lastCharacter = url.slice(-1);
    const containsSlash = lastCharacter === "/";
    if (containsSlash) {
      return url.slice(0, url.length - 1);
    }

    return url;
  };

  _ensureEventExists = eventName => {
    if (!this.events.includes(eventName)) {
      throw new Error("Event doesn't exist");
    }
  };

  _popupWindow = (url, title, w, h) => {
    const y = window.outerHeight / 2 + window.screenY - h / 2;
    const x = window.outerWidth / 2 + window.screenX - w / 2;
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
      width=${w}, 
      height=${h}, 
      top=${y}, 
      left=${x}`
    );
    this._executeEvent("inviteWindowOpened");
    const interval = setInterval(function() {
      if (!openedWindow || openedWindow.closed) {
        clearInterval(interval);
        window.closedWindow();
      }
    }, 500);
  };

  _showPopup = (message = "Waiting for device") => {
    document.querySelector(".popup-overlay").classList.remove("hidden");
    document.querySelector(".auth-message").textContent = message;
    this._executeEvent("popupOverlayOpened");
  };

  _hidePopup = (delay = 2000) => {
    setTimeout(() => {
      document.querySelector(".popup-overlay").classList.add("hidden");
      document
        .querySelector(".auth-message")
        .setAttribute("class", "auth-message");
      this._executeEvent("popupOverlayClosed");
      setTimeout(() => {
        document.querySelector(".auth-message").textContent =
          "Waiting for device";
      }, 200);
    }, delay);
  };

  _updateMessage = (message, status = "success") => {
    document
      .querySelector(".auth-message")
      .classList.add(`autharmor--${status}`);
    document.querySelector(".auth-message").textContent = message;
  };

  _executeEvent = (eventName, ...data) => {
    this._ensureEventExists(eventName);

    const listeners = this.eventListeners.get(eventName);
    listeners.map(listener => listener(...data));
  };

  _init() {
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

    window.openedWindow = () => {
      this._executeEvent("inviteWindowOpened");
      this._showPopup();
      this.requestCompleted = false;
    };

    window.addEventListener("message", message => {
      const parsedMessage = JSON.parse(message.data);

      if (parsedMessage.type === "requestAccepted") {
        this._executeEvent("inviteAccepted", parsedMessage);
        this._updateMessage(parsedMessage.data.message);
        this.requestCompleted = true;
        this._hidePopup();
      }

      if (parsedMessage.type === "requestCancelled") {
        this._executeEvent("inviteCancelled", parsedMessage);
        this._updateMessage(parsedMessage.data.message, "danger");
        this.requestCompleted = true;
        this._hidePopup();
      }

      if (parsedMessage.type === "requestError") {
        this._executeEvent("error", parsedMessage);
        this._updateMessage(parsedMessage.data.message, "danger");
        this.requestCompleted = true;
        this._hidePopup();
      }

      if (parsedMessage.type === "requestExists") {
        this._executeEvent("inviteExists", parsedMessage);
        this._updateMessage(parsedMessage.data.message, "warn");
        this.requestCompleted = true;
        this._hidePopup();
      }
    });

    window.closedWindow = () => {
      this._executeEvent("inviteWindowClosed");

      if (!this.requestCompleted) {
        this._updateMessage("User closed the popup", "danger");
      }

      this._hidePopup();
    };
  }

  // ---- Public Methods

  // -- Event Listener functions

  on(eventName, fn) {
    this._ensureEventExists(eventName);

    const listeners = this.eventListeners.get(eventName);
    this.eventListeners.set(eventName, [...listeners, fn]);
  }

  off(eventName) {
    this._ensureEventExists(eventName);

    this.eventListeners.set(eventName, []);
  }

  // -- Invite functionality

  _setInviteData = ({ inviteCode, signature } = {}) => {
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
      getQRCode: () => {
        const stringifiedInvite = JSON.stringify({
          invite_code: inviteCode,
          aa_sig: signature
        });
        return kjua({
          text: stringifiedInvite,
          rounded: 10,
          back: "#202020",
          fill: "#2db4b4"
        }).src;
      },
      getInviteLink: () => {
        return `${config.inviteURL}/?i=${inviteCode}&aa_sig=${signature}`;
      },
      useInviteLink: () => {
        this._showPopup("Approve invite request");
        this._popupWindow(
          `${config.inviteURL}/?i=${inviteCode}&aa_sig=${signature}`,
          "Link your account with AuthArmor",
          600,
          400
        );
      }
    };
  };

  _generateInviteCode = async ({ nickname, referenceId }) => {
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
        useInviteLink: () => {
          this._showPopup();
          this._popupWindow(
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

  _confirmInvite = async nickname => {
    try {
      this._executeEvent("authenticating");
      this._showPopup();
      const { data } = await Axios.post(
        `/auth/autharmor/invite/confirm`,
        {
          nickname
        },
        { withCredentials: true }
      );

      if (data.response_message === "Timeout") {
        this._updateMessage("Authentication request timed out", "warn");
        this._hidePopup();
        throw data;
      }

      if (data.response_message === "Success") {
        this._updateMessage("Authentication request approved!", "success");
        this._hidePopup();
        return data;
      }

      if (data.response_message === "Declined") {
        this._updateMessage("Authentication request declined", "danger");
        this._hidePopup();
        throw data;
      }

      this._hidePopup();
      return data;
    } catch (err) {
      this._updateMessage(
        err?.response?.data.errorMessage ?? "An error has occurred",
        "danger"
      );
      this._hidePopup();
      throw err?.response?.data
        ? err?.response?.data.errorMessage ?? {
            errorCode: 400,
            errorMessage: "An unknown error has occurred"
          }
        : err;
    }
  };

  _logout = async () => {
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

  _authenticate = async nickname => {
    try {
      this._showPopup();
      const { data } = await Axios.post(
        `/auth/autharmor/auth`,
        {
          nickname
        },
        { withCredentials: true }
      );

      if (data.response_message === "Timeout") {
        this._updateMessage("Authentication request timed out", "warn");
      }

      if (data.response_message === "Success") {
        this._updateMessage("Authentication request approved!", "success");
      }

      if (data.response_message === "Declined") {
        this._updateMessage("Authentication request declined", "danger");
      }

      this._hidePopup();

      return data;
    } catch (err) {
      console.error(err);
      this._hidePopup();
      throw err?.response?.data;
    }
  };

  // Get if user is authenticated
  _getUser = async () => {
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
      generateInviteCode: this._generateInviteCode,
      setInviteData: this._setInviteData,
      confirmInvite: this._confirmInvite
    };
  }

  get auth() {
    return {
      authenticate: this._authenticate,
      getUser: this._getUser,
      logout: this._logout
    };
  }

  get popup() {
    return {
      show: this._showPopup,
      hide: this._hidePopup,
      updateMessage: this._updateMessage
    };
  }
}

export default AuthArmorSDK;

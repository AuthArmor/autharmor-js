var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "axios", "kjua", "./config/index", "./assets/images.json"], function (require, exports, axios_1, kjua_1, index_1, images_json_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    axios_1 = __importDefault(axios_1);
    kjua_1 = __importDefault(kjua_1);
    index_1 = __importDefault(index_1);
    images_json_1 = __importDefault(images_json_1);
    var AuthArmorSDK = /** @class */ (function () {
        function AuthArmorSDK(_a) {
            var _this = this;
            var _b = _a.url, url = _b === void 0 ? "" : _b, _c = _a.polling, polling = _c === void 0 ? false : _c;
            // Private Methods
            this.processUrl = function (url) {
                if (url === void 0) { url = ""; }
                var lastCharacter = url.slice(-1);
                var containsSlash = lastCharacter === "/";
                if (containsSlash) {
                    return url.slice(0, -1);
                }
                return url;
            };
            this.ensureEventExists = function (eventName) {
                if (!_this.events.includes(eventName)) {
                    throw new Error("Event doesn't exist");
                }
            };
            this.popupWindow = function (url, title, w, h) {
                var y = window.outerHeight / 2 + window.screenY - h / 2;
                var x = window.outerWidth / 2 + window.screenX - w / 2;
                var openedWindow = window.open(url, title, "toolbar=no, \n      location=no, \n      directories=no, \n      status=no, \n      menubar=no, \n      scrollbars=no, \n      resizable=no, \n      copyhistory=no, \n      width=" + w + ", \n      height=" + h + ", \n      top=" + y + ", \n      left=" + x);
                _this.executeEvent("inviteWindowOpened");
                var interval = setInterval(function () {
                    if (!openedWindow || openedWindow.closed) {
                        clearInterval(interval);
                        window.closedWindow();
                    }
                }, 500);
            };
            this.showPopup = function (message) {
                if (message === void 0) { message = "Waiting for device"; }
                document.querySelector(".popup-overlay").classList.remove("hidden");
                document.querySelector(".auth-message").textContent = message;
                _this.executeEvent("popupOverlayOpened");
            };
            this.hidePopup = function (delay) {
                if (delay === void 0) { delay = 2000; }
                setTimeout(function () {
                    document.querySelector(".popup-overlay").classList.add("hidden");
                    document
                        .querySelector(".auth-message")
                        .setAttribute("class", "auth-message");
                    _this.executeEvent("popupOverlayClosed");
                    setTimeout(function () {
                        document.querySelector(".auth-message").textContent =
                            "Waiting for device";
                    }, 200);
                }, delay);
            };
            this.updateMessage = function (message, status) {
                if (status === void 0) { status = "success"; }
                var authMessage = document.querySelector(".auth-message");
                if (authMessage) {
                    authMessage.classList.add("autharmor--" + status);
                    authMessage.textContent = message;
                }
            };
            this.executeEvent = function (eventName) {
                var data = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    data[_i - 1] = arguments[_i];
                }
                _this.ensureEventExists(eventName);
                var listeners = _this.eventListeners.get(eventName);
                listeners === null || listeners === void 0 ? void 0 : listeners.map(function (listener) { return listener.apply(void 0, data); });
            };
            // -- Invite functionality
            this.setInviteData = function (_a) {
                var _b = _a === void 0 ? {} : _a, inviteCode = _b.inviteCode, signature = _b.signature;
                if (!inviteCode || !signature) {
                    throw new Error("Please specify an invite code and a signature");
                }
                if (inviteCode !== undefined) {
                    _this.inviteCode = inviteCode;
                }
                if (signature !== undefined) {
                    _this.signature = signature;
                }
                return {
                    getQRCode: function (_a) {
                        var _b = _a === void 0 ? {} : _a, _c = _b.backgroundColor, backgroundColor = _c === void 0 ? "#202020" : _c, _d = _b.fillColor, fillColor = _d === void 0 ? "#2db4b4" : _d, _e = _b.borderRadius, borderRadius = _e === void 0 ? 0 : _e;
                        var stringifiedInvite = JSON.stringify({
                            type: "profile_invite",
                            payload: {
                                invite_code: inviteCode,
                                aa_sig: signature
                            }
                        });
                        var code = kjua_1.default({
                            text: stringifiedInvite,
                            rounded: borderRadius,
                            back: backgroundColor,
                            fill: fillColor
                        });
                        return code.src;
                    },
                    getInviteLink: function () {
                        return index_1.default.inviteURL + "/?i=" + inviteCode + "&aa_sig=" + signature;
                    },
                    useInviteLink: function () {
                        _this.showPopup("Approve invite request");
                        _this.popupWindow(index_1.default.inviteURL + "/?i=" + inviteCode + "&aa_sig=" + signature, "Link your account with AuthArmor", 600, 400);
                    }
                };
            };
            this.generateInviteCode = function (_a) {
                var nickname = _a.nickname, referenceId = _a.referenceId;
                return __awaiter(_this, void 0, void 0, function () {
                    var data_1, err_1;
                    var _this = this;
                    var _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _c.trys.push([0, 2, , 3]);
                                if (!nickname) {
                                    throw new Error("Please specify a nickname for the invite code");
                                }
                                return [4 /*yield*/, axios_1.default.post("/auth/autharmor/invite", {
                                        nickname: nickname,
                                        referenceId: referenceId
                                    }, { withCredentials: true })];
                            case 1:
                                data_1 = (_c.sent()).data;
                                return [2 /*return*/, __assign(__assign({}, data_1), { getQRCode: function (_a) {
                                            var _b = _a === void 0 ? {} : _a, _c = _b.backgroundColor, backgroundColor = _c === void 0 ? "#202020" : _c, _d = _b.fillColor, fillColor = _d === void 0 ? "#2db4b4" : _d, _e = _b.borderRadius, borderRadius = _e === void 0 ? 0 : _e;
                                            var stringifiedInvite = JSON.stringify({
                                                type: "profile_invite",
                                                payload: data_1
                                            });
                                            var code = kjua_1.default({
                                                text: stringifiedInvite,
                                                rounded: borderRadius,
                                                back: backgroundColor,
                                                fill: fillColor
                                            });
                                            return code.src;
                                        }, getInviteLink: function () {
                                            return index_1.default.inviteURL + "/?i=" + data_1.invite_code + "&aa_sig=" + data_1.aa_sig;
                                        }, useInviteLink: function () {
                                            _this.showPopup();
                                            _this.popupWindow(index_1.default.inviteURL + "/?i=" + data_1.invite_code + "&aa_sig=" + data_1.aa_sig, "Link your account with AuthArmor", 600, 400);
                                        } })];
                            case 2:
                                err_1 = _c.sent();
                                throw (_b = err_1 === null || err_1 === void 0 ? void 0 : err_1.response) === null || _b === void 0 ? void 0 : _b.data;
                            case 3: return [2 /*return*/];
                        }
                    });
                });
            };
            this.confirmInvite = function (nickname) { return __awaiter(_this, void 0, void 0, function () {
                var data, err_2;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            _f.trys.push([0, 2, , 3]);
                            this.executeEvent("authenticating");
                            this.showPopup();
                            return [4 /*yield*/, axios_1.default.post("/auth/autharmor/invite/confirm", {
                                    nickname: nickname
                                }, { withCredentials: true })];
                        case 1:
                            data = (_f.sent()).data;
                            if (data.response_message === "Timeout") {
                                this.updateMessage("Authentication request timed out", "warn");
                                this.hidePopup();
                                throw data;
                            }
                            if (data.response_message === "Success") {
                                this.updateMessage("Authentication request approved!", "success");
                                this.hidePopup();
                                return [2 /*return*/, data];
                            }
                            if (data.response_message === "Declined") {
                                this.updateMessage("Authentication request declined", "danger");
                                this.hidePopup();
                                throw data;
                            }
                            this.hidePopup();
                            return [2 /*return*/, data];
                        case 2:
                            err_2 = _f.sent();
                            this.updateMessage((_b = (_a = err_2 === null || err_2 === void 0 ? void 0 : err_2.response) === null || _a === void 0 ? void 0 : _a.data.errorMessage) !== null && _b !== void 0 ? _b : "An error has occurred", "danger");
                            this.hidePopup();
                            throw ((_c = err_2 === null || err_2 === void 0 ? void 0 : err_2.response) === null || _c === void 0 ? void 0 : _c.data)
                                ? (_e = (_d = err_2 === null || err_2 === void 0 ? void 0 : err_2.response) === null || _d === void 0 ? void 0 : _d.data.errorMessage) !== null && _e !== void 0 ? _e : {
                                    errorCode: 400,
                                    errorMessage: "An unknown error has occurred"
                                }
                                : err_2;
                        case 3: return [2 /*return*/];
                    }
                });
            }); };
            this.logout = function () { return __awaiter(_this, void 0, void 0, function () {
                var data, err_3;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, axios_1.default.get("/auth/autharmor/logout", {
                                    withCredentials: true
                                })];
                        case 1:
                            data = (_b.sent()).data;
                            return [2 /*return*/, data];
                        case 2:
                            err_3 = _b.sent();
                            throw (_a = err_3 === null || err_3 === void 0 ? void 0 : err_3.response) === null || _a === void 0 ? void 0 : _a.data;
                        case 3: return [2 /*return*/];
                    }
                });
            }); };
            // -- Authentication functionality
            this.authenticate = function (nickname) { return __awaiter(_this, void 0, void 0, function () {
                var data, err_4;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            this.showPopup();
                            return [4 /*yield*/, axios_1.default.post("/auth/autharmor/auth", {
                                    nickname: nickname
                                }, { withCredentials: true })];
                        case 1:
                            data = (_b.sent()).data;
                            if (data.response_message === "Timeout") {
                                this.updateMessage("Authentication request timed out", "warn");
                            }
                            if (data.response_message === "Success") {
                                this.updateMessage("Authentication request approved!", "success");
                            }
                            if (data.response_message === "Declined") {
                                this.updateMessage("Authentication request declined", "danger");
                            }
                            this.hidePopup();
                            return [2 /*return*/, data];
                        case 2:
                            err_4 = _b.sent();
                            console.error(err_4);
                            this.hidePopup();
                            throw (_a = err_4 === null || err_4 === void 0 ? void 0 : err_4.response) === null || _a === void 0 ? void 0 : _a.data;
                        case 3: return [2 /*return*/];
                    }
                });
            }); };
            // Get if user is authenticated
            this.getUser = function () { return __awaiter(_this, void 0, void 0, function () {
                var data, err_5;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, axios_1.default.get("/auth/autharmor/me", {
                                    withCredentials: true
                                })];
                        case 1:
                            data = (_b.sent()).data;
                            return [2 /*return*/, data];
                        case 2:
                            err_5 = _b.sent();
                            throw (_a = err_5 === null || err_5 === void 0 ? void 0 : err_5.response) === null || _a === void 0 ? void 0 : _a.data;
                        case 3: return [2 /*return*/];
                    }
                });
            }); };
            this.url = this.processUrl(url);
            axios_1.default.defaults.baseURL = this.url;
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
            // @ts-ignore
            Object.entries(this.events.reduce(function (eventListeners, eventName) {
                var _a;
                return (__assign(__assign({}, eventListeners), (_a = {}, _a[eventName] = [], _a)));
            }, {})));
            this.inviteCode = "";
            this.signature = "";
            this.init = this.init.bind(this);
            this.init();
        }
        AuthArmorSDK.prototype.init = function () {
            var _this = this;
            document.body.innerHTML += "\n      <style>\n        .autharmor--danger {\n          background-color: #f55050 !important;\n        }\n\n        .autharmor--warn {\n          background-color: #ff8d18 !important;\n        }\n\n        .popup-overlay {\n          position: fixed;\n          top: 0;\n          left: 0;\n          width: 100%;\n          height: 100%;\n          display: flex;\n          flex-direction: column;\n          justify-content: center;\n          align-items: center;\n          background-color: rgba(53, 57, 64, 0.98);\n          z-index: 100;\n          opacity: 1;\n          visibility: visible;\n          transition: all .2s ease;\n        }\n        \n        .popup-overlay-content {\n          display: flex;\n          flex-direction: column;\n          justify-content: center;\n          align-items: center;\n          border-radius: 15px;\n          overflow: hidden;\n          box-shadow: 0px 20px 50px rgba(0, 0, 0, 0.15);\n          background-color: #2b313c;\n          width: 90%;\n          max-width: 480px;\n          min-width: 300px;\n        }\n        \n        .popup-overlay img {\n          height: 110px;\n          margin-bottom: 40px;\n          margin-top: 40px;\n        }\n        \n        .popup-overlay p {\n          margin: 0;\n          font-weight: bold;\n          color: white;\n          font-size: 18px;\n          padding: 14px 80px;\n          background-color: rgb(0, 128, 128);\n          width: 100%;\n          text-align: center;\n          font-family: 'Montserrat', 'Helvetica Neue', 'Roboto', 'Arial', sans-serif;\n          transition: all .2s ease;\n        }\n\n        .hidden {\n          opacity: 0;\n          visibility: hidden;\n        }\n      </style>\n      <div class=\"popup-overlay hidden\">\n        <div class=\"popup-overlay-content\">\n          <img src=\"" + images_json_1.default.logo + "\" alt=\"AuthArmor Icon\" />\n          <p class=\"auth-message\">Authenticating with AuthArmor...</p>\n        </div>\n      </div>\n    ";
            this.socket = new WebSocket(this.url);
            window.openedWindow = function () {
                _this.executeEvent("inviteWindowOpened");
                _this.showPopup();
                _this.requestCompleted = false;
            };
            window.addEventListener("message", function (message) {
                var parsedMessage = JSON.parse(message.data);
                if (parsedMessage.type === "requestAccepted") {
                    _this.executeEvent("inviteAccepted", parsedMessage);
                    _this.updateMessage(parsedMessage.data.message);
                    _this.requestCompleted = true;
                    _this.hidePopup();
                }
                if (parsedMessage.type === "requestCancelled") {
                    _this.executeEvent("inviteCancelled", parsedMessage);
                    _this.updateMessage(parsedMessage.data.message, "danger");
                    _this.requestCompleted = true;
                    _this.hidePopup();
                }
                if (parsedMessage.type === "requestError") {
                    _this.executeEvent("error", parsedMessage);
                    _this.updateMessage(parsedMessage.data.message, "danger");
                    _this.requestCompleted = true;
                    _this.hidePopup();
                }
                if (parsedMessage.type === "requestExists") {
                    _this.executeEvent("inviteExists", parsedMessage);
                    _this.updateMessage(parsedMessage.data.message, "warn");
                    _this.requestCompleted = true;
                    _this.hidePopup();
                }
            });
            window.closedWindow = function () {
                _this.executeEvent("inviteWindowClosed");
                if (!_this.requestCompleted) {
                    _this.updateMessage("User closed the popup", "danger");
                }
                _this.hidePopup();
            };
        };
        // ---- Public Methods
        // -- Event Listener functions
        AuthArmorSDK.prototype.on = function (eventName, fn) {
            this.ensureEventExists(eventName);
            var listeners = this.eventListeners.get(eventName);
            this.eventListeners.set(eventName, __spreadArray(__spreadArray([], listeners), [fn]));
        };
        AuthArmorSDK.prototype.off = function (eventName) {
            this.ensureEventExists(eventName);
            this.eventListeners.set(eventName, []);
        };
        Object.defineProperty(AuthArmorSDK.prototype, "invite", {
            // Public interfacing SDK functions
            get: function () {
                return {
                    generateInviteCode: this.generateInviteCode,
                    setInviteData: this.setInviteData,
                    confirmInvite: this.confirmInvite
                };
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AuthArmorSDK.prototype, "auth", {
            get: function () {
                return {
                    authenticate: this.authenticate,
                    getUser: this.getUser,
                    logout: this.logout
                };
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AuthArmorSDK.prototype, "popup", {
            get: function () {
                return {
                    show: this.showPopup,
                    hide: this.hidePopup,
                    updateMessage: this.updateMessage
                };
            },
            enumerable: false,
            configurable: true
        });
        return AuthArmorSDK;
    }());
    exports.default = AuthArmorSDK;
});

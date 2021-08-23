# AuthArmor Javascript Client-side SDK

## 🏁 Installation

You can integrate the AuthArmor SDK into your website by installing and importing our NPM package:

```bash
# Via NPM
npm i -s autharmor-sdk

# Via Yarn
yarn add autharmor-sdk
```

You can also load the SDK via our CDN by placing this `script` tag in your app's `<head>`

```html
<script src="https://cdn.autharmor.com/scripts/autharmor-jsclient-sdk/v2.0.0/autharmor-jsclient-sdk_v2.0.0.js"></script>
```

## Typescript

This SDK is fully coded in TypeScript and its definition files are bundled by default when installing it through NPM/Yarn

## 🧭 Usage

### 🚀 Initializing the SDK

In order to initialize the SDK, you'll have to create a new instance of the AuthArmor SDK with the url of your backend API specified in it.

```javascript
const SDK = new AuthArmorSDK({
  url: "https://api.example.com", // specify your backend's url
  basePath: "/auth/autharmor", // specify a prefix where the Backend SDK is mounted, this is set to "/auth/autharmor" by default in both the Client-side and the Backend SDKs
  polling: false // Specify whether you'd like to receive auth status updates via WebSockets (default) or HTTP polling
});
```

## 🧲 Invites

### Generating a new invite

You can easily generate invites to your app by doing the following:

```javascript
// Initialize the SDK
const SDK = new AuthArmorSDK({
  url: "https://api.example.com"
});

// Generate a new invite
const invite = await SDK.invite.generateInviteCode({
  nickname: "", // Specify the invite's nickname
  referenceId: "" // Specify a reference ID for the invite
});

console.log(invite);
/**
 * Returns:
 * {
 *   "nickname": "string",
 *   "invite_code": "string",
 *   "date_expires": "ISODate string",
 *   "invite_type": "string",
 *   "aa_sig": "string"
 * }
 */
```

### Using an invite

Once an invite is generated, there are two methods for having the user consume the invite. You can either have your app show a QR Code which is then scannable using the AuthArmor app, or you can show a browser popup which prompts the user to accept the invite directly through the AuthArmor site:

```javascript
// Display QR Code for user to scan using the AuthArmor app
invite.getQRCode(); // Returns a base64 representation of the QR Code image which can be used by supplying it to an <img> tag

// Or open the invite link in a popup window
invite.openInviteLink();
```

## 🔏 Authentication

### Initializing an authentication request

In order to initialize a login request for authenticating users to your site, you can simply call the `authenticate()` function with the nickname you wish to request an authentication request for along with some info regarding the authentication request (Title, short message, etc...). Once you call the `authenticate()` function, an AuthArmor overlay will appear on top of your app which reacts accordingly to the authentication request's status.

```javascript
try {
  console.log("Authenticating user...");
  await SDK.auth.authenticate({
    nickname: "<string>", // Specify which username you'd like to send the auth request to, leave empty to generate a usernameless QR Code request.
    sendPush: "<boolean>", // Whether or not you'd want to send a push notification regarding the auth request, set it false to allow QR Code scanning only (default: true)
    actionName: "<string>", // Specify the title that shows up when the auth request is opened in the mobile app
    shortMessage: "<string>", // Specify a description for the auth request which shows up when the auth request is opened in the mobile app
    visualVerify: "<boolean>", // Specify whether you'd like to enable Visual Verify feature for this auth request (default: false)
    showPopup: "<boolean>", // Specify if you'd like to show the AuthArmor popup when the authentication starts (default: true)
    qrCodeStyle: {
      borderRadius: "<number>",
      background: "<string>",
      foreground: "<string>"
    },
    locationData: {
      latitude: "<string>",
      longitude: "<string>"
    },
    // This event listener is triggered once the user approves an auth request
    onSuccess: ({
      data: {
          response,
          nickname,
          token,
          authorized
      },
      metadata
    }) => void,
    // This event listener is triggered once the user declines an auth request
    onFailure: ({
      data: {
          response,
          nickname,
          authorized,
      },
      metadata
    }) => void
  });
  console.log("User authenticated!");
} catch (err) {
  console.error("The request was declined or has timed out!", err);
}
```

## 💥 Events

There are several events emitted by the SDK which you can attach to and have your app react accordingly.

### Available Events

| Event Name         | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| inviteWindowOpened | Triggered as soon as the invite popup window is open                       |
| popupOverlayOpened | Triggered once the AuthArmor overlay for invite/auth shows                 |
| popupOverlayClosed | Triggered once the AuthArmor overlay for invite/auth is removed            |
| inviteWindowClosed | Triggered as soon as the invite popup window is closed                     |
| inviteAccepted     | Triggered once a user opens the invite popup and accepts it                |
| inviteCancelled    | Triggered once a user opens the invite popup and presses the cancel button |
| error              | Triggered once an error occurs while accepting/declining an invite         |

### Attaching an event listener

Attaching an event listener is pretty simple, all you'll have to do is call the `on` function with the event you wish to attach a function to followed by a callback function:

```javascript
SDK.on("<event_name>", () => {
  // Do something...
});
```

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
  endpointBasePath: "https://api.example.com/auth/autharmor", // (Optional) specify your backend's url
  publicKey: "...", // (Required) Specify the public-key you've generated from the AuthArmor Dashboard
  webauthnClientId: "...", // (Optional) Specify the WebAuthn Client ID you've generated from the AuthArmor Dashboard
  registerRedirectUrl: "...", // (Optional) Specify the URL that you'd like to redirect the user to after registering
  authenticationRedirectUrl: "..." // (Optional) Specify the URL that you'd like to redirect the user to after logging in
});
```

## 📃 Render the form in your site's UI

The AuthArmor SDK also comes with a pre-built form that you can render anywhere throughout your site which already handles several edge cases out-of-the-box by writing a single line of code!

```js
AuthArmor.form.mount(".example-form-class-name");
```

The form has a couple of other options as well for advanced use, such as styling the form to use the same color scheme as your site or choosing which options you'd like to allow users to use for registration and authentication in your site.

```js
AuthArmor.form.mount(".example-form-class-name", {
  usernameless: true, // (Boolean) Toggle usernameless auth
  defaultTab: "login" // (String) Could be one of ("login" | "register"), specifies tab that's going to be selected once the user lands in the page
  methods: [
    // ('authenticator' | 'magiclink' | 'webauthn') Specify allowed authentication methods
    "authenticator", // Push authentication/registration (Requires AuthArmor app)
    "magiclink", // Login/Register using Email only
    "webauthn" // Login/Register using WebAuthn (Requires webauthnClientId to be specified)
  ],
  styles: {
    // Specify a color scheme for the form to match your theme
    accentColor: "#0bdbdb",
    backgroundColor: "#2a2d35",
    tabColor: "#363a46",
    qrCodeBackground: "#202020",
    highlightColor: "#434857",
    inputBackground: "#212329"
  }
});
```

You can also modify the form's color scheme directly through CSS, this is useful especially if you're trying to have the form adapt for situations like the user switching between light/dark modes, etc...

_Note: All of the form's CSS variables are prefixed with "autharmor" to avoid colliding with your own CSS variables_

```css
:root {
  --autharmor-accent-color: #0bdbdb;
  --autharmor-background-color: #2a2d35;
  --autharmor-tab-color: #363a46;
  --autharmor-qr-code-background: #202020;
  --autharmor-highlight-color: #434857;
  --autharmor-input-background: #212329;
}

@media (prefers-color-scheme: dark) {
  :root {
    --autharmor-accent-color: #0bdbdb;
    --autharmor-background-color: #2a2d35;
    --autharmor-tab-color: #363a46;
    --autharmor-qr-code-background: #202020;
    --autharmor-highlight-color: #434857;
    --autharmor-input-background: #212329;
  }
}
```

## 💥 Events

There are several events emitted by the SDK which you can attach to and have your app react accordingly.

### Available Events

| Event Name         | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| popupOverlayOpened | Triggered once the AuthArmor overlay for invite/auth shows         |
| popupOverlayClosed | Triggered once the AuthArmor overlay for invite/auth is removed    |
| authenticated      | Triggered once an authentication is completed successfully         |
| registerSuccess    | Triggered once a registration is completed successfully            |
| error              | Triggered once an error occurs while accepting/declining an invite |

### Attaching an event listener

Attaching an event listener is pretty simple, all you'll have to do is call the `on` function with the event you wish to attach a function to followed by a callback function:

```javascript
SDK.on("<event_name>", () => {
  // Do something...
});
```

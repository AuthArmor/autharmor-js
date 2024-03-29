# Auth Armor JavaScript Client-Side SDK

Auth Armor provides a SaaS solution to authenticate your users exclusively using passwordless authentication methods such as WebAuthn, magic links and the proprietary Auth Armor mobile app.

This package allows you to access the client-side SDK for Auth Armor so that you can authenticate users on the client side and get a validation token whose legitimacy you can verify server-side and so you can register users using any of the supported methods you would like to offer.

> This package does not come with a UI; if you want a pre-made UI that will work with this package and will allow you to get started with very little configuration, check out [autharmor-js-ui](https://github.com/AuthArmor/autharmor-js-ui).

## Installation

This package is available on the NPM registry as `@autharmor/autharmor-js`. Use your project's package manager to install it:

```sh
# NPM
npm install @autharmor/autharmor-js

# PNPM
pnpm add @autharmor/autharmor-js

# Yarn
yarn add @autharmor/autharmor-js
```

In projects without an NPM package manager, we also serve an IIFE bundle from our CDN which you can load as follows.

```html
<script src="https://cdn.autharmor.com/scripts/autharmor-js/4.0.0-rc.1/global/autharmor-js.js"></script>
```

This module's exports will then be available in the `authArmor` global variable. Instead of `import` statements, you can use destructuring:

```js
const { AuthArmorClient } = authArmor;
```

## Getting Started

This section will demonstrate how you can set up a client and make requests.

### Creating the Configuration Object

You will need to create a configuration object of type [`AuthArmorClientConfiguration`](./src/client/config/AuthArmorClientConfiguration.ts). At a minimum, you must provide a client SDK API key (`clientSdkApiKey`). You can also provide a WebAuthn client ID (`webAuthnClientId`) if you wish to have WebAuthn support in your client.

```ts
const authArmorConfig: AuthArmorClientConfiguration = {
    clientSdkApiKey: "[Your client SDK API key goes here]",
    webAuthnClientId: "[Your WebAuthn client ID goes here]"
};
```

> If you're using TypeScript, you must import `AuthArmorClientConfiguration` at the top of your file:
>
> ```ts
> import { AuthArmorClientConfiguration } from "@autharmor/sdk";
> ```
>
> If you're not using TypeScript, you must omit the `: AuthArmorClientConfiguration` type annotation.

### Instantiating a Client

Once you have the configuration object prepared, you can instantiate `AuthArmorClient` passing it the configuration as a parameter:

```ts
const authArmorClient = new AuthArmorClient(authArmorConfig);
```

> You must import `AuthArmorClient` at the top of your file:
>
> ```ts
> import { AuthArmorClient } from "@autharmor/sdk";
> ```

This client contains all the methods necessary to make requests to Auth Armor.

### Initializing the Client

> All methods that require the client to be initialized will initialize it as necessary. You only need to initialize the client manually if you want control over when this happens.

A client needs to make some initial requests to set itself up to make other requests. The `ensureInitialized` method can be used to initialize it:

```ts
await authArmorClient.ensureInitialized();
```

If the client is already initialized, the method does not do anything.

### Check Available Authentication Methods

To authenticate a user, in most cases, you must first get their available authentication methods. The `getAvailableAuthenticationMethodsAsync` method will return an [`AvailableAuthenticationMethods`](./src/client/models/AuthenticationMethod.ts) object.

```ts
const availableMethods = await authArmorClient.getAvailableAuthenticationMethodsAsync("username");
```

The object returned will look similar to this (depending on which methods the user has enabled):

```ts
{
    authenticator: true,
    magicLinkEmail: false,
    webAuthn: true
}
```

If the user was not found, an `ApiError` will be thrown with `statusCode` set to 404.

### Authenticator Authentication

To authenticate a user using their authenticator app, use the `authenticateWithAuthenticatorAsync` method. It returns a `QrResult` which contains an authentication URL which can either be displayed as a QR code, or, on mobile devices, be navigated to on a separate tab to launch the Auth Armor authenticator app or prompt to install it. Calling the `resultAsync` method on the `QrResult` will return the `AuthenticationResult`.

```ts
const qrResult = await authArmorClient.authenticateWithAuthenticatorAsync("username");

// You can generate a QR code using this URL and display it on the page.
const { qrCodeUrl } = qrResult;

const authenticationResult = await qrResult.resultAsync();

if (authenticationResult.succeeded) {
    // If the authentication succeeds, you can access the validation token. Send it to the server for validation.
    const { requestId, validationToken } = authenticationResult;
} else {
    // Otherwise, you can access the reason the authentication request failed.
    const { failureReason } = authenticationResult;
}
```

You can provide a list of options as the second parameter of `authenticateWithAuthenticatorAsync` like so:

```ts
await authArmorClient.authenticateWithAuthenticatorAsync("username", {
    sendPushNotification: false,
    actionName: "Authorize Request",
    shortMessage: "Authorize your special request"
});
```

### Next Steps

Other authentication and registration methods also follow a similar pattern. Refer to the in-code documentation for details on how they work. If you are using an IDE, you will also be able to view the documentation from within your editor.

As a summary, these are the methods available for you:

| **Method**                                       | **Options Object**                                                                              | **Return Type**                           | **Description**                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| `authenticateWithAuthenticatorAsync`             | [`IAuthenticatorUserSpecificAuthenticateOptions`](./src/client/options/IAuthenticateOptions.ts) | `Promise<QrResult<AuthenticationResult>>` | Authenticates a user using their authenticator app.                            |
| `authenticateWithAuthenticatorUsernamelessAsync` | [`IAuthenticatorUsernamelessAuthenticateOptions`](./src/client/options/IAuthenticateOptions.ts) | `Promise<QrResult<AuthenticationResult>>` | Authenticates a user using an authenticator QR code that is not user-specific. |
| `authenticateWithPasskeyAsync`                   | None                                                                                            | `Promise<AuthenticationResult>`           | Authenticates a user using a passkey.                                          |
| `sendAuthenticateMagicLinkEmailAsync`            | [`IMagicLinkEmailAuthenticateOptions`](./src/client/options/IAuthenticateOptions.ts)            | `Promise<void>`                           | Sends an authentication magic link to the user's email address.                |
| `registerWithAuthenticatorAsync`                 | [`IAuthenticatorRegisterOptions`](./src/client/options/IRegisterOptions.ts)                     | `Promise<QrResult<RegistrationResult>>`   | Registers a user using an authenticator QR code.                               |
| `registerWithPasskeyAsync`                       | [`IPasskeyRegisterOptions`](./src/client/options/IRegisterOptions.ts)                           | `Promise<RegistrationResult>`             | Registers a user using a passkey.                                              |
| `sendRegisterMagicLinkEmailAsync`                | [`IMagicLinkEmailRegisterOptions`](./src/client/options/IRegisterOptions.ts)                    | `Promise<void>`                           | Sends a registration magic link to the user's email address.                   |

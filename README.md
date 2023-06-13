# AuthArmor JavaScript Client-Side SDK

AuthArmor provides a SaaS solution to authenticate your users exclusively using passwordless authentication methods such as WebAuthn, magic links and the proprietary AuthArmor mobile app.

This package allows you to access the client-side SDK for AuthArmor so that you can authenticate users on the client side and get a validation token whose legitimacy you can verify server-side and so you can register users using any of the supported methods you would like to offer.

> This package does not come with a UI; if you want a pre-made UI that will work with this package and will allow you to get started with very little configuration, check out [autharmor-sdk-ui](https://github.com/AuthArmor/autharmor-jsclient-sdk-ui).

## Installation

This package is available on the NPM registry as `@autharmor/sdk`. Use your project's package manager to install it:

```sh
# NPM
npm install @autharmor/sdk

# PNPM
pnpm add @autharmor/sdk

# Yarn
yarn add @autharmor/sdk
```

## Getting Started

This section will demonstrate how you can set up a client and make requests.

### Creating the Configuration Object

You will need to create a configuration object of type `AuthArmorClientConfiguration`. At a minimum, you must provide a client SDK API key (`clientSdkApiKey`). You can also provide a WebAuthn client ID (`webAuthnClientId`) if you wish to have WebAuthn support in your client.

```ts
const authArmorConfig: AuthArmorClientConfiguration = {
    clientSdkApiKey: "[Your client SDK API key goes here]",
    webAuthnClientId: "[Your WebAuthn client ID goes here]"
};
```

### Instantiating a Client

Once you have the configuration object prepared, you can instantiate `AuthArmorClient` passing it the configuration as a parameter:

```ts
const authArmorClient = new AuthArmorClient(authArmorConfig);
```

This client contains all the methods necessary to make requests to AuthArmor.

### Initializing the Client

> All methods that require the client to be initialized will initialize it as necessary. You only need to initialize the client manually if you want control over when this happens.

A client needs to make some initial requests to set itself up to make other requests. The `ensureInitialized` method can be used to initialize it:

```ts
await authArmorClient.ensureInitialized();
```

If the client is already initialized, the method does not do anything.

### Check Available Log In Methods

To log a user in, in most cases, you must first get their available log in methods. The `getAvailableLogInMethodsAsync` method will return an `IAvailableAuthenticationMethods` object.

```ts
const availableMethods = await authArmorClient.getAvailableLogInMethodsAsync("username");
```

The object returned will look similar to this (depending on which methods the user has enabled):

```ts
{
    authenticator: true,
    emailMagicLink: false,
    webAuthn: true
}
```

If the user was not found, an `ApiError` will be thrown with `statusCode` set to 404.

### Authenticator Log In

To log in a user using their authenticator app, use the `logInWithAuthenticatorAsync` method. It returns a `QrResult` which contains a log in URL which can either be displayed as a QR code, or, on mobile devices, be navigated to on a separate tab to launch the AuthArmor authenticator app or prompt to install it. Calling the `resultAsync` method on the `QrResult` will return the `AuthenticationResult`.

```ts
const qrResult = await authArmorClient.logInWithAuthenticatorAsync("username");

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

### Next Steps

Other log in and registration methods also follow a similar pattern. Refer to the in-code documentation for details on how they work. If you are using an IDE, you will also be able to view the documentation from within your editor.

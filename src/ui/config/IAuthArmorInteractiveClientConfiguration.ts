import {
    IAuthenticatorRegisterOptions,
    IAuthenticatorUserSpecificLogInOptions,
    IEmailMagicLinkLogInOptions,
    IEmailMagicLinkRegisterOptions,
    ILogInOptions,
    IRegisterOptions,
    IWebAuthnRegisterOptions
} from "../../client";

export interface IAuthArmorInteractiveClientConfiguration {
    defaultLogInOptions?: Partial<ILogInOptions>;
    defaultAuthenticatorLogInOptions?: Partial<IAuthenticatorUserSpecificLogInOptions>;
    defaultEmailMagicLinkLogInOptions?: Partial<IEmailMagicLinkLogInOptions>;
    defaultRegisterOptions?: Partial<IRegisterOptions>;
    defaultAuthenticatorRegisterOptions?: Partial<IAuthenticatorRegisterOptions>;
    defaultWebAuthnRegisterOptions?: Partial<IWebAuthnRegisterOptions>;
    defaultEmailMagicLinkRegisterOptions?: Partial<IEmailMagicLinkRegisterOptions>;

    emailMagicLinkRedirectUrl?: string;
}

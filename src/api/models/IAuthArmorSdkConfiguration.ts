export interface IAuthArmorSdkConfiguration {
    recaptcha: AuthArmorSdkRecaptchaConfiguration;
}

interface IAuthArmorSdkRecaptchaConfigurationWhenEnabled {
    enabled: true;
    siteId: string;
}

interface IAuthArmorSdkRecaptchaConfigurationWhenDisabled {
    enabled: false;
}

type AuthArmorSdkRecaptchaConfiguration =
    | IAuthArmorSdkRecaptchaConfigurationWhenEnabled
    | IAuthArmorSdkRecaptchaConfigurationWhenDisabled;

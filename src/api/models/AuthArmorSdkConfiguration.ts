export type AuthArmorSdkConfiguration = AuthArmorSdkRecaptchaConfiguration;

interface IAuthArmorSdkRecaptchaConfigurationWhenEnabled {
    google_v3_recaptcha_enabled: true;
    // This is misspelled as recpatcha on origin.
    google_v3_recpatcha_site_id: string;
}

interface IAuthArmorSdkRecaptchaConfigurationWhenDisabled {
    google_v3_recaptcha_enabled: false;
}

type AuthArmorSdkRecaptchaConfiguration =
    | IAuthArmorSdkRecaptchaConfigurationWhenEnabled
    | IAuthArmorSdkRecaptchaConfigurationWhenDisabled;

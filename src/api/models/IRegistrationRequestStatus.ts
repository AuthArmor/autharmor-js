export interface IRegistrationRequestStatus {
    registration_status_name: string;
    registration_status_code: RegistrationRequestStatusCode;
    auth_method: string;
}

export enum RegistrationRequestStatusCode {
    Unknown = 0,
    PendingUserAcceptance = 1,
    Registered = 2,
    Declined = 3,
    InvalidSignature = 4,
    Timeout = 5,
    AcceptedPendingDeviceEnrollment = 6,
    PendingValidation = 8,
    ValidationTimeout = 9,
    SecurityException = 10
}

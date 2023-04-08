export interface IAuthenticationRequestStatus {
    auth_method: string;
    auth_request_status_id: AuthenticationRequestStatusId;
    auth_request_status_name: string;
    auth_response_code: AuthenticationRequestCode;
    auth_response_message: string | null;
}

export enum AuthenticationRequestStatusId {
    Failed = 2,
    PendingApproval = 3,
    PendingValidation = 4
}

export enum AuthenticationRequestCode {
    Pending = 0,
    Declined = 3,
    TimedOut = 5,
    Succeeded = 8
}

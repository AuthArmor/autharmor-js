export interface IAuthArmorAuthenticatorEnrollmentStatus {
    authenticator_enrollment_status: AuthArmorAuthenticatorEnrollmentStatusField;
    user_id: string;
    username: string;
}

type AuthArmorAuthenticatorEnrollmentStatusField =
    | "not_enrolled_or_not_found"
    | "enrolled";

export {
  KYC_VERIFICATION_DASHBOARD_DETAIL_MESSAGE as EMAIL_VERIFICATION_DASHBOARD_DETAIL_MESSAGE,
  KYC_VERIFICATION_DASHBOARD_DETAIL_MESSAGE as EMAIL_VERIFICATION_LOCK_DETAIL_MESSAGE,
  KYC_VERIFICATION_REQUIRED_MESSAGE as EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  isUserFullyVerified,
  showKycVerificationRequiredAlert as showEmailVerificationRequiredAlert,
  showKycVerificationRequiredToast as resendVerificationEmailWithAlert,
} from "./verificationGate";

export { isUserFullyVerified as hasVerifiedEmail } from "./verificationGate";

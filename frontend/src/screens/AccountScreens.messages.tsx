import type { ReactNode } from "react";
import { defineMessages } from "platform-core";

/** The email-link screens (`AccountScreens.tsx`) and the bare login/signup screens' "done" line. */
// oxlint-disable-next-line react/only-export-components
export default defineMessages({
  en: {
    genericError: "Something went wrong. Please try again.",
    email: "Email",
    forgotSent: (v: { email: ReactNode }) => (
      <>If an account uses <strong>{v.email}</strong>, a link to reset its password is on its way. It works for 2 hours.</>
    ),
    forgotIntro: "Forgot your password? We'll email you a link to choose a new one.",
    sending: "Sending...",
    emailMeLink: "Email me a link",
    resetIntro: "Choose a password for your account.",
    newPassword: "New password",
    minLength: "At least {n} characters.",
    repeatIt: "Repeat it",
    mismatch: "The passwords don't match.",
    saving: "Saving...",
    saveAndSignIn: "Save password and sign in",
    confirming: "Confirming your email…",
    checkEmail: (v: { email: ReactNode }) => (
      <>We sent a link to <strong>{v.email}</strong>. Open it to confirm your address and sign in - it works for 7 days.</>
    ),
    sentAgain: "Sent again",
    sendAgain: "Send it again",
    signedInAs: "Signed in as {name} ({email}).",
    accountCreated: "Account created for {name} ({email}).",
  },
  vi: {
    genericError: "Đã có lỗi xảy ra. Vui lòng thử lại.",
    email: "Email",
    forgotSent: (v: { email: ReactNode }) => (
      <>Nếu có tài khoản dùng <strong>{v.email}</strong>, liên kết đặt lại mật khẩu đang được gửi tới. Liên kết có hiệu lực trong 2 giờ.</>
    ),
    forgotIntro: "Quên mật khẩu? Chúng tôi sẽ gửi email cho bạn một liên kết để chọn mật khẩu mới.",
    sending: "Đang gửi...",
    emailMeLink: "Gửi liên kết cho tôi",
    resetIntro: "Chọn mật khẩu cho tài khoản của bạn.",
    newPassword: "Mật khẩu mới",
    minLength: "Ít nhất {n} ký tự.",
    repeatIt: "Nhập lại mật khẩu",
    mismatch: "Hai mật khẩu không khớp.",
    saving: "Đang lưu...",
    saveAndSignIn: "Lưu mật khẩu và đăng nhập",
    confirming: "Đang xác nhận email của bạn…",
    checkEmail: (v: { email: ReactNode }) => (
      <>Chúng tôi đã gửi liên kết tới <strong>{v.email}</strong>. Mở liên kết để xác nhận địa chỉ và đăng nhập - liên kết có hiệu lực trong 7 ngày.</>
    ),
    sentAgain: "Đã gửi lại",
    sendAgain: "Gửi lại",
    signedInAs: "Đã đăng nhập với tên {name} ({email}).",
    accountCreated: "Đã tạo tài khoản cho {name} ({email}).",
  },
});

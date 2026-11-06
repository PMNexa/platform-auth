import { defineMessages } from "platform-core";

/** The `createAuthRoutes` pages' own text: footer links and the in-between screens. */
export default defineMessages({
  en: {
    noAccount: "No account yet?",
    signUp: "Sign up",
    haveAccount: "Already have an account?",
    logIn: "Log in",
    forgotPassword: "Forgot password?",
    backToLogin: "Back to log in",
    needNewLink: "Need a new link?",
    ssoFailed: "Signing in didn't finish. Try again.",
    ssoSigningIn: "Signing you in…",
    viewAsNoToken: "This link has no token - open it from the user's page.",
    viewAsExpired: "This view has expired - start it again from the user's page.",
    viewAsOpening: "Opening the read-only view…",
  },
  vi: {
    noAccount: "Chưa có tài khoản?",
    signUp: "Đăng ký",
    haveAccount: "Đã có tài khoản?",
    logIn: "Đăng nhập",
    forgotPassword: "Quên mật khẩu?",
    backToLogin: "Quay lại đăng nhập",
    needNewLink: "Cần liên kết mới?",
    ssoFailed: "Đăng nhập chưa hoàn tất. Vui lòng thử lại.",
    ssoSigningIn: "Đang đăng nhập cho bạn…",
    viewAsNoToken: "Liên kết này không có token - hãy mở từ trang của người dùng.",
    viewAsExpired: "Phiên xem này đã hết hạn - hãy bắt đầu lại từ trang của người dùng.",
    viewAsOpening: "Đang mở chế độ chỉ xem…",
  },
});

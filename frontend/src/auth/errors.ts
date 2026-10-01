/** Thrown by `signup` when the account was created but its email must be confirmed first. */
export class VerificationPendingError extends Error {
  email: string;

  constructor(email: string) {
    super("Check your email to confirm your address.");
    this.name = "VerificationPendingError";
    this.email = email;
  }
}

// Server-only bounded policy. Invalid configuration fails closed at the identity boundary.
export function identityPolicy(env = process.env) {
  const number = (key, fallback, min, max) => {
    const value = Number(env[key] || fallback);
    if (!Number.isInteger(value) || value < min || value > max)
      throw Error("IDENTITY_POLICY_INVALID");
    return value;
  };
  return {
    verificationMinutes: number("IDENTITY_VERIFICATION_MINUTES", 10, 1, 30),
    resetMinutes: number("IDENTITY_RESET_MINUTES", 60, 5, 120),
    maxAttempts: number("IDENTITY_MAX_ATTEMPTS", 5, 1, 10),
    resendSeconds: number("IDENTITY_RESEND_SECONDS", 60, 30, 3600),
  };
}

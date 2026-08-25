"use client";

import { ChevronRight, Eye, EyeOff, KeyRound, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button, Card, Input, Label } from "@/components/atoms";
import { BirgusLogo } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { APP_ROUTES } from "@/lib/routes";

interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginApiSuccessPayload {
  twoFactorRequired?: boolean;
  challengeToken?: string;
  setupRequired?: boolean;
  setup?: {
    secret?: string;
    otpauthUri?: string;
  } | null;
}

export function LoginForm() {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [twoFactorChallengeToken, setTwoFactorChallengeToken] = useState<string | null>(null);
  const [twoFactorSetupSecret, setTwoFactorSetupSecret] = useState<string | null>(null);
  const [twoFactorSetupUri, setTwoFactorSetupUri] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false);

  const router = useRouter();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const resetTwoFactorState = () => {
    setTwoFactorChallengeToken(null);
    setTwoFactorSetupSecret(null);
    setTwoFactorSetupUri(null);
    setTwoFactorCode("");
  };

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setIsSubmitting(true);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          rememberMe: data.rememberMe,
        }),
      });

      const payload = (await response.json().catch(() => null)) as LoginApiSuccessPayload | { message?: string } | null;

      if (
        response.status === 202
        && payload
        && typeof payload === "object"
        && "twoFactorRequired" in payload
        && payload.twoFactorRequired
      ) {
        const challengeToken = typeof payload.challengeToken === "string" ? payload.challengeToken : "";
        if (!challengeToken.trim()) {
          throw new Error("Challenge 2FA non disponibile.");
        }

        setTwoFactorChallengeToken(challengeToken);
        setTwoFactorSetupSecret(payload.setupRequired ? payload.setup?.secret ?? null : null);
        setTwoFactorSetupUri(payload.setupRequired ? payload.setup?.otpauthUri ?? null : null);
        setTwoFactorCode("");
        toast.info(t("auth.enterAuthenticatorCode"));
        return;
      }

      if (!response.ok) {
        const message = payload && typeof payload === "object" && "message" in payload ? payload.message : undefined;
        throw new Error(message ?? t("auth.invalidCredentials"));
      }

      resetTwoFactorState();
      toast.success(t("auth.loginSuccess"));
      router.push(APP_ROUTES.dashboard);
      router.refresh();
    } catch (error) {
      const fallbackMessage = t("auth.loginFailed");
      const message = error instanceof Error ? error.message : fallbackMessage;
      toast.error(message || fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    if (!twoFactorChallengeToken) {
      toast.error(t("auth.otpMissing"));
      return;
    }

    const normalizedCode = twoFactorCode.replace(/\s+/g, "").trim();
    if (!/^\d{6,10}$/.test(normalizedCode)) {
      toast.error(t("auth.otpInvalid"));
      return;
    }

    try {
      setIsVerifyingTwoFactor(true);
      const response = await fetch("/api/auth/login/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken: twoFactorChallengeToken,
          otpCode: normalizedCode,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Verifica 2FA non riuscita.");
      }

      resetTwoFactorState();
      toast.success(t("auth.twoFactorSuccess"));
      router.push(APP_ROUTES.dashboard);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verifica 2FA non riuscita.";
      toast.error(message);
    } finally {
      setIsVerifyingTwoFactor(false);
    }
  };

  const handleSendRecoveryCode = async () => {
    const email = recoveryEmail.trim().toLowerCase();
    if (!email) {
      toast.error(t("auth.emailInvalid"));
      return;
    }

    try {
      setIsSendingCode(true);
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
        if (payload?.code === "AUTH_PASSWORD_RESET_EMAIL_FAILED") {
          window.alert(
            "Invio email non riuscito.\nAvvisa il tuo amministratore oppure contatta support.ai@fgautomazioni.it.",
          );
        }
        throw new Error(payload?.message ?? "Invio codice non riuscito.");
      }

      setRecoveryEmail(email);
      setIsCodeSent(true);
      toast.success(t("auth.recoverySent"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invio codice non riuscito.";
      toast.error(message);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleResetPassword = async () => {
    if (!recoveryCode.trim() || !recoveryEmail.trim()) {
      toast.error("Inserisci email e codice ricevuto.");
      return;
    }

    if (recoveryPassword.trim().length < 5) {
      toast.error("La nuova password deve contenere almeno 5 caratteri.");
      return;
    }

    if (recoveryPassword !== recoveryConfirmPassword) {
      toast.error("Le password non coincidono.");
      return;
    }

    try {
      setIsResettingPassword(true);
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recoveryEmail.trim().toLowerCase(),
          code: recoveryCode.trim(),
          newPassword: recoveryPassword,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Reset password non riuscito.");
      }

      toast.success(t("auth.passwordUpdated"));
      setIsRecoveryOpen(false);
      setIsCodeSent(false);
      setRecoveryCode("");
      setRecoveryPassword("");
      setRecoveryConfirmPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset password non riuscito.";
      toast.error(message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const renderTwoFactorSection = twoFactorChallengeToken
    ? (
      <div
        className="mt-6 rounded-[var(--radius-md)] border border-border-default bg-bg-muted p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-brand-primary" />
          <p className="text-sm font-bold text-text-primary">{t("auth.twoFactor")}</p>
        </div>

        <div className="space-y-3">
          {twoFactorSetupSecret && (
            <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-bg-surface p-3">
              <p className="text-xs font-semibold text-text-secondary">{t("auth.twoFactorSetup")}</p>
              {twoFactorSetupUri && (
                <div className="mt-3 flex justify-center rounded-[var(--radius-sm)] bg-white p-3">
                  <QRCodeSVG
                    value={twoFactorSetupUri}
                    size={184}
                    level="M"
                    marginSize={2}
                    title={t("auth.twoFactorQr")}
                  />
                </div>
              )}
              <p className="mt-1 text-xs text-text-muted">Secret TOTP</p>
              <p className="mt-1 break-all rounded-[var(--radius-sm)] bg-bg-muted px-2 py-1 font-mono text-xs text-text-primary">
                {twoFactorSetupSecret}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="two-factor-code">{t("auth.otp")}</Label>
            <Input
              id="two-factor-code"
              name="two-factor-code"
              value={twoFactorCode}
              onChange={(event) => setTwoFactorCode(event.target.value)}
              disabled={isVerifyingTwoFactor}
              className="mt-1"
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleVerifyTwoFactor();
                }
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              disabled={isVerifyingTwoFactor}
              onClick={() => {
                resetTwoFactorState();
                const emailValue = getValues("email").trim().toLowerCase();
                setRecoveryEmail((prev) => prev || emailValue);
              }}
            >
              {t("auth.cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 flex-1"
              disabled={isVerifyingTwoFactor}
              onClick={() => void handleVerifyTwoFactor()}
            >
              {isVerifyingTwoFactor ? t("auth.verifying") : t("auth.verify")}
            </Button>
          </div>
        </div>
      </div>
    )
    : null;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-bg-page px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <BirgusLogo className="mb-10 mx-auto h-14 w-auto" />
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-brand-primary">
          {t("auth.title")}
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border border-border-subtle px-4 py-10 shadow-elevated sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email", { required: "L'email e obbligatoria" })}
                  disabled={isSubmitting || !!twoFactorChallengeToken || isVerifyingTwoFactor}
                  className="pl-10 pr-3"
                  placeholder="admin@fgautomazioni.it"
                />
                {errors.email && <p className="mt-1 text-xs font-medium text-status-danger-text">{errors.email.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password", {
                    required: "La password e obbligatoria",
                    minLength: { value: 1, message: "Password non valida" },
                  })}
                  disabled={isSubmitting || !!twoFactorChallengeToken || isVerifyingTwoFactor}
                  className="pl-10 pr-10"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isSubmitting || !!twoFactorChallengeToken || isVerifyingTwoFactor}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-blue-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
                {errors.password && (
                  <p className="mt-1 text-xs font-medium text-status-danger-text">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  disabled={isSubmitting || !!twoFactorChallengeToken || isVerifyingTwoFactor}
                  {...register("rememberMe")}
                  className="h-4 w-4 cursor-pointer rounded-lg border-slate-300 text-brand-primary transition-colors focus:ring-blue-500"
                />
                <label htmlFor="remember-me" className="ml-2 block cursor-pointer text-sm text-text-secondary">
                  {t("auth.remember")}
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen((prev) => !prev)}
                  className="font-semibold text-brand-accent transition-colors hover:text-brand-accent-hover"
                  disabled={!!twoFactorChallengeToken}
                >
                  {t("auth.forgot")}
                </button>
              </div>
            </div>

            <div>
              <Button
                type="submit"
                className="h-14 w-full rounded-[var(--radius-md)] py-3.5"
                disabled={isSubmitting || !!twoFactorChallengeToken || isVerifyingTwoFactor}
              >
                <LogIn className="h-5 w-5" />
                {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
                <ChevronRight className="ml-1 h-4 w-4 opacity-50" />
              </Button>
            </div>
          </form>

          {renderTwoFactorSection}

          {isRecoveryOpen && (
            <div className="mt-6 rounded-[var(--radius-md)] border border-border-default bg-bg-muted p-4">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={16} className="text-brand-primary" />
                <p className="text-sm font-bold text-text-primary">{t("auth.recovery")}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="recovery-email">{t("auth.accountEmail")}</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    value={recoveryEmail}
                    onChange={(event) => setRecoveryEmail(event.target.value)}
                    disabled={isSendingCode || isResettingPassword}
                    className="mt-1"
                    placeholder="admin@fgautomazioni.it"
                  />
                </div>

                {!isCodeSent && (
                  <Button
                    type="button"
                    className="h-10 w-full"
                    onClick={() => void handleSendRecoveryCode()}
                    disabled={isSendingCode}
                  >
                    {isSendingCode ? t("auth.sendingCode") : t("auth.sendCode")}
                  </Button>
                )}

                {isCodeSent && (
                  <>
                    <div>
                      <Label htmlFor="recovery-code">{t("auth.oneTimeCode")}</Label>
                      <Input
                        id="recovery-code"
                        value={recoveryCode}
                        onChange={(event) => setRecoveryCode(event.target.value)}
                        disabled={isResettingPassword}
                        className="mt-1"
                        placeholder="Codice a 6 cifre"
                      />
                    </div>
                    <div>
                      <Label htmlFor="recovery-password">{t("auth.newPassword")}</Label>
                      <Input
                        id="recovery-password"
                        type="password"
                        value={recoveryPassword}
                        onChange={(event) => setRecoveryPassword(event.target.value)}
                        disabled={isResettingPassword}
                        className="mt-1"
                        placeholder="Nuova password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="recovery-password-confirm">{t("auth.confirmPassword")}</Label>
                      <Input
                        id="recovery-password-confirm"
                        type="password"
                        value={recoveryConfirmPassword}
                        onChange={(event) => setRecoveryConfirmPassword(event.target.value)}
                        disabled={isResettingPassword}
                        className="mt-1"
                        placeholder="Conferma password"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 flex-1"
                        onClick={() => setIsCodeSent(false)}
                        disabled={isResettingPassword}
                      >
                        {t("auth.newCode")}
                      </Button>
                      <Button
                        type="button"
                        className="h-10 flex-1"
                        onClick={() => void handleResetPassword()}
                        disabled={isResettingPassword}
                      >
                        {isResettingPassword ? t("auth.updating") : t("auth.resetPassword")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

"use client";

import { ChevronRight, Eye, EyeOff, KeyRound, Lock, LogIn, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button, Card, Input, Label } from "@/components/atoms";
import { BirgusLogo } from "@/components/molecules";
import { APP_ROUTES } from "@/lib/routes";

interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export function LoginForm() {
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
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

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

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Credenziali non valide.");
      }

      toast.success("Accesso effettuato con successo.");
      router.push(APP_ROUTES.dashboard);
      router.refresh();
    } catch (error) {
      const fallbackMessage = "Accesso non riuscito.";
      const message = error instanceof Error ? error.message : fallbackMessage;
      toast.error(message || fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendRecoveryCode = async () => {
    const email = recoveryEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Inserisci un indirizzo email valido.");
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
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Invio codice non riuscito.");
      }

      setRecoveryEmail(email);
      setIsCodeSent(true);
      toast.success("Se l'account esiste, riceverai un codice monouso via email.");
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

      toast.success("Password aggiornata. Ora puoi accedere.");
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

  return (
    <div className="flex min-h-screen flex-col justify-center bg-bg-page px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <BirgusLogo className="mb-10 mx-auto h-14 w-auto" />
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-brand-primary">
          Accedi al project manager di FGautomazioni
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border border-border-subtle px-4 py-10 shadow-elevated sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Label htmlFor="email">Indirizzo email</Label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email", { required: "L'email e obbligatoria" })}
                  disabled={isSubmitting}
                  className="pl-10 pr-3"
                  placeholder="admin@fgautomazioni.it"
                />
                {errors.email && <p className="mt-1 text-xs font-medium text-status-danger-text">{errors.email.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
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
                  disabled={isSubmitting}
                  className="pl-10 pr-10"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  {...register("rememberMe")}
                  className="h-4 w-4 cursor-pointer rounded-lg border-slate-300 text-brand-primary transition-colors focus:ring-blue-500"
                />
                <label htmlFor="remember-me" className="ml-2 block cursor-pointer text-sm text-text-secondary">
                  Ricordami
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen((prev) => !prev)}
                  className="font-semibold text-brand-accent transition-colors hover:text-brand-accent-hover"
                >
                  Password dimenticata?
                </button>
              </div>
            </div>

            <div>
              <Button type="submit" className="h-14 w-full rounded-[var(--radius-md)] py-3.5" disabled={isSubmitting}>
                <LogIn className="h-5 w-5" />
                {isSubmitting ? "Accesso..." : "Accedi"}
                <ChevronRight className="ml-1 h-4 w-4 opacity-50" />
              </Button>
            </div>
          </form>

          {isRecoveryOpen && (
            <div className="mt-6 rounded-[var(--radius-md)] border border-border-default bg-bg-muted p-4">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={16} className="text-brand-primary" />
                <p className="text-sm font-bold text-text-primary">Recupero password</p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="recovery-email">Email account</Label>
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
                    {isSendingCode ? "Invio codice..." : "Invia codice via email"}
                  </Button>
                )}

                {isCodeSent && (
                  <>
                    <div>
                      <Label htmlFor="recovery-code">Codice monouso</Label>
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
                      <Label htmlFor="recovery-password">Nuova password</Label>
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
                      <Label htmlFor="recovery-password-confirm">Conferma password</Label>
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
                        Nuovo codice
                      </Button>
                      <Button
                        type="button"
                        className="h-10 flex-1"
                        onClick={() => void handleResetPassword()}
                        disabled={isResettingPassword}
                      >
                        {isResettingPassword ? "Aggiornamento..." : "Reimposta password"}
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

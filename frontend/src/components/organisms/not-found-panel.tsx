import { AlertCircle } from "lucide-react";

export function NotFoundPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
      <div className="rounded-[var(--radius-xl)] bg-status-danger-bg p-6 text-status-danger-text shadow-[0_16px_30px_rgba(254,202,202,0.6)] transition-transform hover:scale-110">
        <AlertCircle size={64} />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-brand-primary">404 - Pagina non trovata</h1>
      <p className="max-w-sm text-text-muted">
        La pagina che stai cercando non esiste o e stata spostata in un&apos;altra sezione del portale.
      </p>
    </div>
  );
}

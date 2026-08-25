export const UI_LANGUAGE_STORAGE_KEY = "birgus-ui-language";

export const UI_LANGUAGES = ["it", "en"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

const messages: Record<string, Record<UiLanguage, string>> = {
  "language.italian": { it: "Italiano", en: "Italian" },
  "language.english": { it: "Inglese", en: "English" },
  "language.switch": { it: "Lingua interfaccia", en: "Interface language" },
  "nav.projects": { it: "Progetti", en: "Projects" },
  "nav.clients": { it: "Clienti", en: "Clients" },
  "nav.shipments": { it: "Spedizioni", en: "Shipments" },
  "nav.customerMap": { it: "Mappa clienti", en: "Customer map" },
  "nav.offerPriority": { it: "Priorita offerte", en: "Offer priorities" },
  "nav.maintenanceProposals": { it: "Proposte manutenzione", en: "Maintenance proposals" },
  "nav.maintenanceCalendar": { it: "Calendario manutenzioni", en: "Maintenance calendar" },
  "nav.workflows": { it: "Workflow", en: "Workflows" },
  "nav.archive": { it: "Archivio", en: "Archive" },
  "nav.settings": { it: "Impostazioni", en: "Settings" },
  "nav.exit": { it: "Esci", en: "Sign out" },
  "nav.compactLogo": { it: "Logo compatto", en: "Compact logo" },
  "nav.expand": { it: "Espandi menu laterale", en: "Expand sidebar" },
  "nav.collapse": { it: "Comprimi menu laterale", en: "Collapse sidebar" },
  "nav.personalDashboard": { it: "Apri dashboard personale", en: "Open personal dashboard" },
  "notifications.title": { it: "Comunicazioni", en: "Notifications" },
  "notifications.clear": { it: "Pulisci", en: "Clear" },
  "notifications.loading": { it: "Caricamento comunicazioni...", en: "Loading notifications..." },
  "notifications.empty": { it: "Hai zero comunicazioni.", en: "You have no notifications." },
  "notifications.cleared": { it: "Notifiche eliminate.", en: "Notifications cleared." },
  "notifications.clearFailed": { it: "Cancellazione notifiche non riuscita.", en: "Unable to clear notifications." },
  "settings.ai.loadModels": { it: "Ricerca modelli", en: "Search models" },
  "settings.ai.modelsOne": { it: "Modello caricato: {model}", en: "Model loaded: {model}" },
  "settings.ai.modelsMany": { it: "Trovati {count} modelli.", en: "Found {count} models." },
  "settings.ai.modelsEmpty": { it: "Provider raggiunto, nessun modello elencato.", en: "Provider reached, but it returned no models." },
  "settings.ai.valid": { it: "Connessione valida. Modello: {model}", en: "Connection valid. Model: {model}" },
  "settings.ai.saved": { it: "Configurazione AI salvata.", en: "AI configuration saved." },
  "settings.ai.loadFailed": { it: "Impossibile leggere le impostazioni AI.", en: "Unable to load AI settings." },
  "settings.ai.providerFailed": { it: "La richiesta al provider IA non e riuscita.", en: "The AI provider request failed." },
  "auth.title": { it: "Accedi al project manager di FGautomazioni", en: "Sign in to the FGautomazioni project manager" },
  "auth.email": { it: "Indirizzo email", en: "Email address" },
  "auth.password": { it: "Password", en: "Password" },
  "auth.remember": { it: "Ricordami", en: "Remember me" },
  "auth.forgot": { it: "Password dimenticata?", en: "Forgot password?" },
  "auth.signIn": { it: "Accedi", en: "Sign in" },
  "auth.signingIn": { it: "Accesso...", en: "Signing in..." },
  "auth.twoFactor": { it: "Autenticazione a due fattori", en: "Two-factor authentication" },
  "auth.twoFactorSetup": { it: "Configura l'app (una sola volta)", en: "Set up your authenticator app (once)" },
  "auth.twoFactorQr": { it: "QR code autenticazione a due fattori", en: "Two-factor authentication QR code" },
  "auth.otp": { it: "Codice OTP", en: "OTP code" },
  "auth.cancel": { it: "Annulla", en: "Cancel" },
  "auth.verify": { it: "Verifica 2FA", en: "Verify 2FA" },
  "auth.verifying": { it: "Verifica...", en: "Verifying..." },
  "auth.recovery": { it: "Recupero password", en: "Password recovery" },
  "auth.accountEmail": { it: "Email account", en: "Account email" },
  "auth.sendCode": { it: "Invia codice via email", en: "Send code by email" },
  "auth.sendingCode": { it: "Invio codice...", en: "Sending code..." },
  "auth.oneTimeCode": { it: "Codice monouso", en: "One-time code" },
  "auth.newPassword": { it: "Nuova password", en: "New password" },
  "auth.confirmPassword": { it: "Conferma password", en: "Confirm password" },
  "auth.newCode": { it: "Nuovo codice", en: "New code" },
  "auth.resetPassword": { it: "Reimposta password", en: "Reset password" },
  "auth.updating": { it: "Aggiornamento...", en: "Updating..." },
  "auth.invalidCredentials": { it: "Credenziali non valide.", en: "Invalid credentials." },
  "auth.loginFailed": { it: "Accesso non riuscito.", en: "Sign-in failed." },
  "auth.loginSuccess": { it: "Accesso effettuato con successo.", en: "Signed in successfully." },
  "auth.enterAuthenticatorCode": { it: "Inserisci il codice dell'app autenticatore per completare il login.", en: "Enter the code from your authenticator app to complete sign-in." },
  "auth.otpMissing": { it: "Challenge 2FA mancante. Ripeti il login.", en: "Missing 2FA challenge. Sign in again." },
  "auth.otpInvalid": { it: "Inserisci un codice OTP valido.", en: "Enter a valid OTP code." },
  "auth.twoFactorFailed": { it: "Verifica 2FA non riuscita.", en: "2FA verification failed." },
  "auth.twoFactorSuccess": { it: "Autenticazione a due fattori completata.", en: "Two-factor authentication completed." },
  "auth.emailInvalid": { it: "Inserisci un indirizzo email valido.", en: "Enter a valid email address." },
  "auth.recoverySent": { it: "Se l'account esiste, riceverai un codice monouso via email.", en: "If the account exists, you will receive a one-time code by email." },
  "auth.resetFailed": { it: "Reset password non riuscito.", en: "Password reset failed." },
  "auth.passwordUpdated": { it: "Password aggiornata. Ora puoi accedere.", en: "Password updated. You can now sign in." },
  "settings.title": { it: "Impostazioni", en: "Settings" },
  "settings.help": { it: "Modifica le preferenze visive dell'app.", en: "Edit the visual preferences for the app." },
  "settings.subtitle": { it: "Personalizza le tue preferenze", en: "Customize your preferences" },
  "settings.palette": { it: "Palette colore", en: "Color palette" },
  "settings.notificationsPosition": { it: "Posizione notifiche", en: "Notification position" },
  "settings.ocr.title": { it: "Modulo OCR", en: "OCR module" },
  "settings.ocr.description": { it: "Abilita il lettore DDT e l'elaborazione OCR nel workspace corrente.", en: "Enable the DDT reader and OCR processing in the current workspace." },
  "settings.ocr.runtime": { it: "Disattivandolo il container OCR viene arrestato e la sua memoria viene liberata. Riattivandolo, il servizio viene avviato di nuovo.", en: "Disabling it stops the OCR container and releases its memory. Enabling it starts the service again." },
  "settings.ocr.containerStopped": { it: "Servizio OCR arrestato: memoria del container liberata.", en: "OCR service stopped: container memory released." },
  "settings.ocr.sharedRunning": { it: "OCR resta attivo perche e ancora abilitato in un altro workspace.", en: "OCR remains active because it is still enabled in another workspace." },
  "settings.ocr.containerStarted": { it: "Servizio OCR avviato.", en: "OCR service started." },
  "settings.ocr.starting": { it: "OCR in preparazione: i modelli Paddle vengono caricati in background.", en: "OCR is preparing: Paddle models are loading in the background." },
  "settings.ocr.ready": { it: "OCR pronto all'uso.", en: "OCR is ready to use." },
  "settings.ocr.readyFailed": { it: "OCR non e riuscito a caricare i modelli.", en: "OCR could not load its models." },
  "settings.ocr.readyTimeout": { it: "OCR sta impiegando piu del previsto. Puoi continuare a lavorare: lo stato verra aggiornato al prossimo controllo.", en: "OCR is taking longer than expected. You can keep working; its status will update on the next check." },
  "settings.ocr.stopFailed": { it: "Modulo OCR aggiornato, ma il container non e stato arrestato. Verifica il servizio OCR lifecycle e Docker.", en: "OCR module updated, but the container was not stopped. Check the OCR lifecycle service and Docker." },
  "settings.active": { it: "Attivo", en: "Enabled" },
  "settings.inactive": { it: "Disattivo", en: "Disabled" },
  "settings.ai.title": { it: "Provider IA", en: "AI provider" },
  "settings.ai.description": { it: "Scegli il tuo provider di AI", en: "Choose your AI provider" },
  "settings.ai.model": { it: "Modello AI", en: "AI model" },
  "settings.ai.selectModel": { it: "Seleziona modello", en: "Select model" },
  "settings.ai.noModels": { it: "nessun modello disponibile", en: "no model available" },
  "settings.validate": { it: "Carica", en: "Load" },
  "settings.save": { it: "Salva", en: "Save" },
  "settings.mail.title": { it: "Provider email", en: "Email provider" },
  "settings.mail.description": { it: "Provider usato dai workflow per inviare email e allegati.", en: "Provider used by workflows to send email and attachments." },
  "common.notFound": { it: "404 - Pagina non trovata", en: "404 - Page not found" },
  "common.notFoundDescription": { it: "La pagina che stai cercando non esiste oppure non hai i permessi per visualizzarla.", en: "The page you are looking for does not exist or you do not have permission to view it." },
  "common.confirmDelete": { it: "Conferma eliminazione", en: "Confirm deletion" },
  "common.delete": { it: "Elimina", en: "Delete" },
  "common.confirmDeletePrompt": { it: "Sei sicuro di voler cancellare questo elemento?", en: "Are you sure you want to delete this item?" },
  "common.typeExactly": { it: "Digita esattamente:", en: "Type exactly:" },
  "common.confirmationText": { it: "Inserisci il testo di conferma", en: "Enter the confirmation text" },
  "common.quickHelp": { it: "Aiuto rapido", en: "Quick help" },
  "common.quickHelpPage": { it: "Aiuto rapido pagina", en: "Quick page help" },
  "ai.error.network": {
    it: "Impossibile raggiungere il provider IA. Controlla Base URL: IP o nome host, porta, servizio avviato e rete Docker.",
    en: "Unable to reach the AI provider. Check the Base URL: IP address or hostname, port, running service, and Docker network.",
  },
  "ai.error.timeout": {
    it: "Il provider IA non ha risposto entro il timeout. Verifica che il modello sia avviato o aumenta il timeout.",
    en: "The AI provider did not respond before the timeout. Check that the model is running or increase the timeout.",
  },
  "ai.error.unauthorized": {
    it: "Il provider IA ha rifiutato le credenziali. Verifica la chiave API configurata.",
    en: "The AI provider rejected the credentials. Check the configured API key.",
  },
  "ai.error.forbidden": {
    it: "Il provider IA ha negato l'accesso. Verifica permessi, chiave API e policy del servizio.",
    en: "The AI provider denied access. Check permissions, API key, and service policy.",
  },
  "ai.error.endpoint": {
    it: "L'endpoint del provider non esiste. Verifica Base URL e il percorso OpenAI-compatible /v1/models.",
    en: "The provider endpoint does not exist. Check the Base URL and the OpenAI-compatible /v1/models path.",
  },
  "ai.error.invalidResponse": {
    it: "Il provider ha risposto in un formato non compatibile. Deve esporre una risposta OpenAI-compatible per /v1/models.",
    en: "The provider returned an incompatible format. It must expose an OpenAI-compatible response for /v1/models.",
  },
  "ai.error.http": {
    it: "Il provider IA ha restituito un errore del server. Verifica i log del servizio e che il modello sia disponibile.",
    en: "The AI provider returned a server error. Check the service logs and that the model is available.",
  },
};

export const isUiLanguage = (value: string | null): value is UiLanguage => UI_LANGUAGES.includes(value as UiLanguage);

export function translate(language: UiLanguage, key: string, values: Record<string, string | number> = {}): string {
  const template = messages[key]?.[language] ?? messages[key]?.it ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}

export function aiProviderErrorMessage(language: UiLanguage, code: string | null): string {
  switch (code) {
    case "AI_PROVIDER_NETWORK_UNREACHABLE": return translate(language, "ai.error.network");
    case "AI_PROVIDER_TIMEOUT": return translate(language, "ai.error.timeout");
    case "AI_PROVIDER_UNAUTHORIZED": return translate(language, "ai.error.unauthorized");
    case "AI_PROVIDER_FORBIDDEN": return translate(language, "ai.error.forbidden");
    case "AI_PROVIDER_ENDPOINT_NOT_FOUND": return translate(language, "ai.error.endpoint");
    case "AI_PROVIDER_INVALID_RESPONSE": return translate(language, "ai.error.invalidResponse");
    default: return translate(language, "ai.error.http");
  }
}

export type PermissionCategory =
  | "read"
  | "create"
  | "modify"
  | "action"
  | "configure";

export interface PermissionCatalogEntry {
  key: string;
  label: { it: string; en: string };
  category: PermissionCategory;
  description: { it: string; en: string };
  sensitive?: boolean;
}

const labels: Record<
  string,
  [string, string, string, string, string, boolean?]
> = {
  "modules.read": [
    "Lettura moduli",
    "Read modules",
    "workspace",
    "Visualizza i moduli disponibili.",
    "View available modules.",
  ],
  "modules.configure": [
    "Configurazione moduli",
    "Configure modules",
    "workspace",
    "Modifica la configurazione dei moduli.",
    "Change module configuration.",
  ],
  "projects.read": [
    "Lettura progetti",
    "Read projects",
    "content",
    "Visualizza i progetti.",
    "View projects.",
  ],
  "projects.write": [
    "Modifica progetti",
    "Edit projects",
    "content",
    "Crea e modifica i progetti.",
    "Create and edit projects.",
  ],
  "agents.read": [
    "Lettura agenti",
    "Read agents",
    "automation",
    "Visualizza gli agenti.",
    "View agents.",
  ],
  "agents.write": [
    "Modifica agenti",
    "Edit agents",
    "automation",
    "Crea e modifica gli agenti.",
    "Create and edit agents.",
  ],
  "clients.read": [
    "Lettura clienti",
    "Read clients",
    "content",
    "Visualizza i clienti.",
    "View clients.",
  ],
  "clients.write": [
    "Modifica clienti",
    "Edit clients",
    "content",
    "Crea e modifica i clienti.",
    "Create and edit clients.",
  ],
  "clients.delete_permanently": [
    "Eliminazione definitiva clienti",
    "Permanently delete clients",
    "security",
    "Elimina definitivamente i dati cliente.",
    "Permanently delete client data.",
    true,
  ],
  "documents.read": [
    "Lettura documenti",
    "Read documents",
    "content",
    "Visualizza i documenti.",
    "View documents.",
  ],
  "documents.write": [
    "Modifica documenti",
    "Edit documents",
    "content",
    "Carica e modifica i documenti.",
    "Upload and edit documents.",
  ],
  "ddt.read": [
    "Lettura DDT",
    "Read delivery notes",
    "content",
    "Visualizza i DDT.",
    "View delivery notes.",
  ],
  "ddt.process": [
    "Elaborazione DDT",
    "Process delivery notes",
    "automation",
    "Elabora i DDT.",
    "Process delivery notes.",
  ],
  "measure_report.read": [
    "Lettura report misure",
    "Read measurement reports",
    "content",
    "Visualizza i report misure.",
    "View measurement reports.",
  ],
  "measure_report.process": [
    "Elaborazione report misure",
    "Process measurement reports",
    "automation",
    "Elabora i report misure.",
    "Process measurement reports.",
  ],
  "knowledge.read": [
    "Lettura knowledge base",
    "Read knowledge base",
    "content",
    "Consulta la knowledge base.",
    "Consult the knowledge base.",
  ],
  "knowledge.write": [
    "Modifica knowledge base",
    "Edit knowledge base",
    "content",
    "Aggiorna la knowledge base.",
    "Update the knowledge base.",
  ],
  "assistant.read": [
    "Lettura assistente",
    "Read assistant",
    "automation",
    "Usa l'assistente.",
    "Use the assistant.",
  ],
  "assistant.write": [
    "Modifica assistente",
    "Edit assistant",
    "automation",
    "Gestisce conversazioni e contenuti dell'assistente.",
    "Manage assistant conversations and content.",
  ],
  "assistant.configure": [
    "Configurazione assistente",
    "Configure assistant",
    "security",
    "Configura strumenti e accessi dell'assistente.",
    "Configure assistant tools and access.",
  ],
  "brainy.read": [
    "Lettura Brainy",
    "Read Brainy",
    "automation",
    "Visualizza Brainy.",
    "View Brainy.",
  ],
  "brainy.write": [
    "Modifica Brainy",
    "Edit Brainy",
    "automation",
    "Modifica contenuti Brainy.",
    "Edit Brainy content.",
  ],
  "brainy.configure": [
    "Configurazione Brainy",
    "Configure Brainy",
    "security",
    "Configura Brainy.",
    "Configure Brainy.",
  ],
  "workflows.read": [
    "Lettura workflow",
    "Read workflows",
    "automation",
    "Visualizza i workflow.",
    "View workflows.",
  ],
  "workflows.write": [
    "Modifica workflow",
    "Edit workflows",
    "automation",
    "Crea e modifica i workflow.",
    "Create and edit workflows.",
  ],
  "workflows.configure": [
    "Configurazione workflow",
    "Configure workflows",
    "security",
    "Configura i workflow.",
    "Configure workflows.",
  ],
  "commission_registry.read": [
    "Lettura commesse",
    "Read commissions",
    "content",
    "Visualizza l'anagrafica commesse.",
    "View commission registry.",
  ],
  "commission_registry.write": [
    "Modifica commesse",
    "Edit commissions",
    "content",
    "Modifica l'anagrafica commesse.",
    "Edit commission registry.",
  ],
  "commission_registry.configure": [
    "Configurazione commesse",
    "Configure commissions",
    "security",
    "Configura l'anagrafica commesse.",
    "Configure commission registry.",
  ],
  "commission_intake.read": [
    "Lettura checklist",
    "Read checklists",
    "content",
    "Visualizza le checklist.",
    "View checklists.",
  ],
  "commission_intake.write": [
    "Modifica checklist",
    "Edit checklists",
    "content",
    "Modifica le checklist.",
    "Edit checklists.",
  ],
  "commission_intake.configure": [
    "Configurazione checklist",
    "Configure checklists",
    "security",
    "Configura le checklist.",
    "Configure checklists.",
  ],
  "commission_details.read": [
    "Lettura dettaglio commesse",
    "Read commission details",
    "content",
    "Visualizza il dettaglio delle commesse.",
    "View commission details.",
  ],
  "commission_details.configure": [
    "Configurazione dettaglio commesse",
    "Configure commission details",
    "security",
    "Configura le connessioni dati del dettaglio commesse.",
    "Configure commission-detail data connections.",
    true,
  ],
  "customer_map.read": [
    "Lettura mappa clienti",
    "Read customer map",
    "content",
    "Visualizza la mappa clienti.",
    "View customer map.",
  ],
  "customer_map.write": [
    "Modifica mappa clienti",
    "Edit customer map",
    "content",
    "Modifica la mappa clienti.",
    "Edit customer map.",
  ],
  "offer_priority.read": [
    "Lettura priorità offerte",
    "Read offer priorities",
    "content",
    "Visualizza le priorità offerte.",
    "View offer priorities.",
  ],
  "offer_priority.write": [
    "Modifica priorità offerte",
    "Edit offer priorities",
    "content",
    "Modifica le priorità offerte.",
    "Edit offer priorities.",
  ],
  "maintenance_proposals.read": [
    "Lettura proposte manutenzione",
    "Read maintenance proposals",
    "content",
    "Visualizza le proposte manutenzione.",
    "View maintenance proposals.",
  ],
  "maintenance_proposals.write": [
    "Modifica proposte manutenzione",
    "Edit maintenance proposals",
    "content",
    "Modifica le proposte manutenzione.",
    "Edit maintenance proposals.",
  ],
  "maintenance_calendar.read": [
    "Lettura calendario manutenzioni",
    "Read maintenance calendar",
    "content",
    "Visualizza il calendario manutenzioni.",
    "View maintenance calendar.",
  ],
  "maintenance_calendar.write": [
    "Modifica calendario manutenzioni",
    "Edit maintenance calendar",
    "content",
    "Modifica il calendario manutenzioni.",
    "Edit maintenance calendar.",
  ],
  "notifications.read": [
    "Lettura notifiche",
    "Read notifications",
    "communication",
    "Visualizza le notifiche.",
    "View notifications.",
  ],
  "notifications.write": [
    "Gestione notifiche",
    "Manage notifications",
    "communication",
    "Gestisce le notifiche.",
    "Manage notifications.",
  ],
  "email.smtp": [
    "Invio email SMTP",
    "SMTP email sending",
    "communication",
    "Consente l'invio tramite server SMTP.",
    "Allows sending through an SMTP server.",
    true,
  ],
  "email.resend": [
    "Invio email Resend",
    "Resend email sending",
    "communication",
    "Consente l'invio tramite Resend.",
    "Allows sending through Resend.",
    true,
  ],
  "audit.read": [
    "Lettura audit",
    "Read audit logs",
    "security",
    "Visualizza i log di audit.",
    "View audit logs.",
  ],
  "dashboard.monitoring.read": [
    "Monitoraggio dashboard",
    "Dashboard monitoring",
    "security",
    "Visualizza le attivita monitorate nella dashboard.",
    "View monitored activity in the dashboard.",
  ],
};

const categoryForKey = (key: string, fallback: string): PermissionCategory => {
  if (key.endsWith(".read")) return "read";
  if (key.endsWith(".write")) return "modify";
  if (key.endsWith(".configure") || key === "modules.configure")
    return "configure";
  if (
    key.startsWith("email.") ||
    key.endsWith(".process") ||
    key === "notifications.write" ||
    key === "clients.delete_permanently"
  )
    return "action";
  return fallback === "create" ? "create" : "configure";
};

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = Object.entries(
  labels,
).map(([key, value]) => ({
  key,
  label: { it: value[0], en: value[1] },
  category: categoryForKey(key, value[2]),
  description: { it: value[3], en: value[4] },
  ...(value[5] ? { sensitive: true } : {}),
}));
export const PERMISSION_KEYS = PERMISSION_CATALOG.map((entry) => entry.key);

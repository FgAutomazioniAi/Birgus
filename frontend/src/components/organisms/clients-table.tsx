"use client";

import {
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Columns3,
  FileDown,
  Filter,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, CheckboxControl, Input, Text } from "@/components/atoms";
import { PageHelpHint, SearchField, SelectDropdown } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { cn } from "@/lib/cn";
import { downloadTablePdf } from "@/lib/pdf-export";
import { APP_ROUTES } from "@/lib/routes";
import { scheduleUndoableAction } from "@/lib/undoable-action";
import type { Client, Company } from "@/lib/types";

type ClientColumnKey = "name" | "email" | "phone" | "notes" | "actions";

interface ClientColumnDef {
  cellClassName?: string;
  key: ClientColumnKey;
  label: string;
  render: (client: Client) => ReactNode;
  required: boolean;
}

interface StoredColumnConfig {
  hidden: ClientColumnKey[];
  order: ClientColumnKey[];
}

interface UserPreferencesResponse {
  colonneClienti?: StoredColumnConfig | null;
  righeClienti?: number;
}

const TABLE_COLUMNS_STORAGE_KEY = "vl_clients_table_columns_v1";
const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 40] as const;

const DEFAULT_CLIENT_COLUMN_ORDER: ClientColumnKey[] = ["name", "email", "phone", "notes", "actions"];

type CompanyFormState = Omit<Company, "id">;
type CompanyTextFieldKey = Exclude<keyof CompanyFormState, "isHeadquarters">;

interface ClientFormState {
  name: string;
  companyId: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  city: string;
  province: string;
  country: string;
  notes: string;
}

const EMPTY_COMPANY_FORM: CompanyFormState = {
  name: "",
  isHeadquarters: false,
  vatNumber: "",
  taxCode: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  postalCode: "",
  city: "",
  province: "",
  country: "Italia",
  latitude: "",
  longitude: "",
  notes: "",
};

const EMPTY_CLIENT_FORM: ClientFormState = {
  name: "",
  companyId: "",
  role: "",
  department: "",
  email: "",
  phone: "",
  mobile: "",
  address: "",
  city: "",
  province: "",
  country: "Italia",
  notes: "",
};

const isClientColumnKey = (value: string): value is ClientColumnKey =>
  DEFAULT_CLIENT_COLUMN_ORDER.includes(value as ClientColumnKey);

const CLIENT_COLUMN_DEFS: ClientColumnDef[] = [
  {
    key: "name",
    label: "Nome Cliente",
    required: true,
    render: (client) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-warn-bg text-xs font-bold text-status-warn-text">
          {client.name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <span className="block text-sm font-bold text-brand-primary">{client.name}</span>
          {client.name === "FG Automazioni" && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-status-success-text">
              <ShieldCheck size={10} /> Verificato Premium
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "email",
    label: "Email",
    required: false,
    render: (client) => (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Mail size={14} className="text-text-muted" />
        {client.email}
      </div>
    ),
  },
  {
    key: "phone",
    label: "Telefono",
    required: false,
    render: (client) => (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Phone size={14} className="text-text-muted" />
        {client.phone}
      </div>
    ),
  },
  {
    key: "notes",
    label: "Note",
    required: false,
    render: (client) => (
      <div className="flex max-w-xs items-center gap-2 truncate text-sm italic text-text-muted" title={client.notes}>
        <MessageSquare size={14} className="text-text-muted" />
        {client.notes}
      </div>
    ),
  },
  {
    key: "actions",
    label: "Azioni",
    required: true,
    cellClassName: "text-right",
    render: () => null,
  },
];

export function ClientsTable() {
  const { t } = useLanguage();
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeRegistry, setActiveRegistry] = useState<"companies" | "clients">("companies");
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ClientColumnKey[]>(DEFAULT_CLIENT_COLUMN_ORDER);
  const [hiddenColumns, setHiddenColumns] = useState<ClientColumnKey[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPreferencesReady, setIsPreferencesReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(EMPTY_COMPANY_FORM);
  const [clientForm, setClientForm] = useState<ClientFormState>(EMPTY_CLIENT_FORM);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isGeocodingCompany, setIsGeocodingCompany] = useState(false);
  const [geocodedAddress, setGeocodedAddress] = useState("");
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/clients", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Errore caricamento clienti");
      }

      const data = (await response.json()) as Client[];
      setClients(data);
    } catch {
      toast.error("Impossibile caricare i clienti.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await fetch("/api/companies", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Errore caricamento aziende");
      }

      const data = (await response.json()) as Company[];
      setCompanies(data);
    } catch {
      toast.error("Impossibile caricare le aziende.");
    }
  };

  useEffect(() => {
    void loadClients();
    void loadCompanies();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!columnsMenuRef.current) {
        return;
      }

      if (!columnsMenuRef.current.contains(event.target as Node)) {
        setIsColumnsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const applyColumnConfig = (config: Partial<StoredColumnConfig> | null | undefined) => {
    if (!config) {
      return;
    }

    const parsedOrder = Array.isArray(config.order)
      ? config.order.filter((column): column is ClientColumnKey => isClientColumnKey(String(column)))
      : [];
    const uniqueOrder = Array.from(new Set(parsedOrder));
    const nextOrder = DEFAULT_CLIENT_COLUMN_ORDER.filter((column) => uniqueOrder.includes(column));
    const missing = DEFAULT_CLIENT_COLUMN_ORDER.filter((column) => !nextOrder.includes(column));
    setColumnOrder([...nextOrder, ...missing]);

    const parsedHidden = Array.isArray(config.hidden)
      ? config.hidden.filter((column): column is ClientColumnKey => isClientColumnKey(String(column)))
      : [];
    const optionalColumns = new Set(CLIENT_COLUMN_DEFS.filter((column) => !column.required).map((column) => column.key));
    setHiddenColumns(parsedHidden.filter((column) => optionalColumns.has(column)));
  };

  useEffect(() => {
    const storedRaw = window.localStorage.getItem(TABLE_COLUMNS_STORAGE_KEY);
    if (!storedRaw) {
      return;
    }

    try {
      const parsed = JSON.parse(storedRaw) as Partial<StoredColumnConfig>;
      applyColumnConfig(parsed);
    } catch {
      setColumnOrder(DEFAULT_CLIENT_COLUMN_ORDER);
      setHiddenColumns([]);
    }
  }, []);

  useEffect(() => {
    const payload: StoredColumnConfig = { order: columnOrder, hidden: hiddenColumns };
    window.localStorage.setItem(TABLE_COLUMNS_STORAGE_KEY, JSON.stringify(payload));
  }, [columnOrder, hiddenColumns]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/user/preferences", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as UserPreferencesResponse;
        applyColumnConfig(data.colonneClienti);

        const preferredRows = data.righeClienti;
        if (preferredRows && ROWS_PER_PAGE_OPTIONS.includes(preferredRows as (typeof ROWS_PER_PAGE_OPTIONS)[number])) {
          setRowsPerPage(preferredRows);
        }
      } catch {
        // fallback su cache locale.
      } finally {
        setIsPreferencesReady(true);
      }
    };

    void loadPreferences();
  }, []);

  useEffect(() => {
    if (!isPreferencesReady) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const persist = async () => {
        try {
          await fetch("/api/user/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              righeClienti: rowsPerPage,
              colonneClienti: {
                order: columnOrder,
                hidden: hiddenColumns,
              },
            }),
          });
        } catch {
          // fallback su localStorage.
        }
      };

      void persist();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [columnOrder, hiddenColumns, isPreferencesReady, rowsPerPage]);

  const filteredClients = useMemo(
    () =>
      clients.filter((client) => {
        const lowered = searchTerm.toLowerCase();
        return (
          client.name.toLowerCase().includes(lowered) ||
          client.email.toLowerCase().includes(lowered) ||
          client.phone.toLowerCase().includes(lowered)
        );
      }),
    [clients, searchTerm],
  );

  const visibleColumns = useMemo(() => {
    const ordered = columnOrder
      .map((key) => CLIENT_COLUMN_DEFS.find((column) => column.key === key))
      .filter((column): column is ClientColumnDef => Boolean(column));
    return ordered.filter((column) => !hiddenColumns.includes(column.key));
  }, [columnOrder, hiddenColumns]);

  const filteredCompanies = useMemo(() => {
    const lowered = searchTerm.toLowerCase();
    return companies.filter((company) =>
      [
        company.name,
        company.vatNumber,
        company.taxCode,
        company.email,
        company.phone,
        company.city,
        company.province,
        company.notes,
      ].some((value) => (value ?? "").toLowerCase().includes(lowered)),
    );
  }, [companies, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredClients.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredClients, rowsPerPage]);

  const totalVisibleColumns = Math.max(visibleColumns.length, 1);

  const handleDelete = (client: Client) => {
    const previousClients = clients;
    setClients((prev) => prev.filter((item) => item.id !== client.id));

    scheduleUndoableAction({
      pendingMessage: `Cliente "${client.name}" in archiviazione...`,
      successMessage: "Cliente archiviato.",
      errorMessage: "Archiviazione cliente non riuscita.",
      rollback: () => setClients(previousClients),
      commit: async () => {
        const response = await fetch(`/api/clients/${client.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmText: "cancella" }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ message: "Errore archiviazione cliente" }))) as { message?: string };
          throw new Error(payload.message ?? "Errore archiviazione cliente");
        }
      },
    });
  };

  const toggleColumnVisibility = (key: ClientColumnKey) => {
    const column = CLIENT_COLUMN_DEFS.find((item) => item.key === key);
    if (!column || column.required) {
      return;
    }

    setHiddenColumns((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const moveColumn = (key: ClientColumnKey, direction: "up" | "down") => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(key);
      if (index < 0) {
        return prev;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const firstVisibleRow = filteredClients.length ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const lastVisibleRow = filteredClients.length
    ? Math.min(currentPage * rowsPerPage, filteredClients.length)
    : 0;

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const exportClientsPdf = async () => {
    if (!filteredClients.length) {
      toast.error("Nessun cliente da esportare.");
      return;
    }

    try {
      setIsExporting(true);
      await downloadTablePdf({
        columns: [
          { key: "name", label: "Nome Cliente" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Telefono" },
          { key: "notes", label: "Note" },
        ],
        filename: `clienti-${new Date().toISOString().slice(0, 10)}.pdf`,
        rows: filteredClients.map((client) => ({
          email: client.email,
          name: client.name,
          notes: client.notes,
          phone: client.phone,
        })),
        subtitle: `Totale clienti esportati: ${filteredClients.length}`,
        title: "Elenco Clienti",
      });
      toast.success("PDF clienti generato con successo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'esportazione clienti.");
    } finally {
      setIsExporting(false);
    }
  };

  const saveCompany = async () => {
    const normalizedName = companyForm.name.trim();
    if (normalizedName.length < 2) {
      toast.error("Inserisci un nome azienda di almeno 2 caratteri.");
      return;
    }

    try {
      setIsSavingCompany(true);
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...companyForm, name: normalizedName }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Errore salvataggio azienda" })) as { message?: string };
        throw new Error(payload.message ?? "Errore salvataggio azienda");
      }
      const created = await response.json() as Company;
      setCompanies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCompanyForm(EMPTY_COMPANY_FORM);
      setIsCompanyDialogOpen(false);
      toast.success("Azienda creata.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio azienda non riuscito.");
    } finally {
      setIsSavingCompany(false);
    }
  };

  const updateCompanyField = (key: CompanyTextFieldKey, value: string) => {
    setCompanyForm((current) => ({
      ...current,
      [key]: value,
      ...(["address", "postalCode", "city", "province", "country"].includes(key)
        ? { latitude: "", longitude: "" }
        : {}),
    }));
    if (["address", "postalCode", "city", "province", "country"].includes(key)) {
      setGeocodedAddress("");
    }
  };

  const geocodeCompany = async () => {
    if (!companyForm.address.trim() || !companyForm.city.trim()) {
      toast.error("Inserisci almeno indirizzo e citta.");
      return;
    }

    try {
      setIsGeocodingCompany(true);
      const response = await fetch("/api/companies/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: companyForm.address,
          postalCode: companyForm.postalCode,
          city: companyForm.city,
          province: companyForm.province,
          country: companyForm.country || "Italia",
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        displayName?: string;
        latitude?: string;
        longitude?: string;
        message?: string;
      };
      if (!response.ok || !payload.latitude || !payload.longitude) {
        throw new Error(payload.message ?? "Posizione non trovata.");
      }
      setCompanyForm((current) => ({ ...current, latitude: payload.latitude!, longitude: payload.longitude! }));
      setGeocodedAddress(payload.displayName ?? "Posizione trovata");
      toast.success("Posizione trovata e pronta per il salvataggio.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ricerca posizione non riuscita.");
    } finally {
      setIsGeocodingCompany(false);
    }
  };

  const saveClient = async () => {
    const normalizedName = clientForm.name.trim();
    if (normalizedName.length < 2) {
      toast.error("Inserisci un nome cliente di almeno 2 caratteri.");
      return;
    }

    try {
      setIsSavingClient(true);
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientForm,
          name: normalizedName,
          companyId: clientForm.companyId ? Number(clientForm.companyId) : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Errore salvataggio cliente" })) as { message?: string };
        throw new Error(payload.message ?? "Errore salvataggio cliente");
      }
      const created = await response.json() as Client;
      setClients((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setClientForm(EMPTY_CLIENT_FORM);
      setIsClientDialogOpen(false);
      setActiveRegistry("clients");
      toast.success("Cliente creato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio cliente non riuscito.");
    } finally {
      setIsSavingClient(false);
    }
  };

  const companyClients = (companyId: number) => clients.filter((client) => client.companyId === companyId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Text as="h1" variant="h1">
              Clienti
            </Text>
            <PageHelpHint text={t("clients.help")} />
          </div>
          <Text variant="muted">{t("clients.subtitle")}</Text>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-[var(--radius-md)] px-4 py-2.5"
            onClick={() => setIsCompanyDialogOpen(true)}
          >
            <Building2 size={18} />
            Nuova azienda
          </Button>
          <Button
            variant="primary"
            className="h-11 rounded-[var(--radius-md)] px-4 py-2.5"
            onClick={() => setIsClientDialogOpen(true)}
          >
            <UserPlus size={20} />
            {t("clients.new")}
          </Button>
        </div>
      </div>

      <Card className="overflow-visible">
        <div className="flex gap-2 border-b border-border-subtle p-4">
          {[
            { key: "companies" as const, label: "Aziende" },
            { key: "clients" as const, label: "Clienti" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveRegistry(tab.key)}
              className={cn(
                "h-10 rounded-[var(--radius-md)] px-4 text-sm font-bold transition-colors",
                activeRegistry === tab.key
                  ? "bg-brand-primary text-text-inverse"
                  : "border border-border-default bg-bg-page text-text-secondary hover:bg-bg-subtle",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col justify-between gap-4 border-b border-border-subtle p-4 md:flex-row md:items-center">
          <SearchField
            className="max-w-md flex-1"
            placeholder={t("clients.search")}
            value={searchTerm}
            onChange={setSearchTerm}
          />

          <div className="flex flex-wrap items-center gap-2">
            {activeRegistry === "clients" ? (
              <>
            <div className="relative" ref={columnsMenuRef}>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-lg px-3 py-2 font-medium"
                onClick={() => setIsColumnsMenuOpen((prev) => !prev)}
              >
                <Columns3 size={18} />
                Colonne
              </Button>

              {isColumnsMenuOpen && (
                <div className="absolute right-0 top-12 z-20 w-80 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3 shadow-elevated">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">Configura colonne</p>
                  <p className="mt-1 text-xs text-text-muted">Mostra, nascondi e riordina le colonne della tabella.</p>

                  <div className="mt-3 space-y-2">
                    {columnOrder.map((key, index) => {
                      const column = CLIENT_COLUMN_DEFS.find((item) => item.key === key);
                      if (!column) {
                        return null;
                      }

                      const hidden = hiddenColumns.includes(column.key);
                      return (
                        <div
                          key={column.key}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-muted px-2.5 py-2"
                        >
                          <label className="flex items-center gap-2 text-sm text-text-secondary">
                            <CheckboxControl
                              type="checkbox"
                              checked={!hidden}
                              disabled={column.required}
                              onChange={() => toggleColumnVisibility(column.key)}
                            />
                            <span className={cn("font-medium", column.required ? "text-text-primary" : "text-text-secondary")}>
                              {column.label}
                            </span>
                            {column.required && <span className="text-[10px] font-bold uppercase text-brand-primary">🔒</span>}
                          </label>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveColumn(column.key, "up")}
                              disabled={index === 0}
                              className="rounded-md border border-border-default p-1 text-text-muted transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Sposta in alto ${column.label}`}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              onClick={() => moveColumn(column.key, "down")}
                              disabled={index === columnOrder.length - 1}
                              className="rounded-md border border-border-default p-1 text-text-muted transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Sposta in basso ${column.label}`}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" className="h-10 rounded-lg px-3 py-2 font-medium">
              <Filter size={18} />
              Filtra
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-lg px-3 py-2 font-medium"
              onClick={() => void exportClientsPdf()}
              disabled={isExporting}
            >
              <FileDown size={16} />
              Esporta
            </Button>
              </>
            ) : null}
          </div>
        </div>

        {activeRegistry === "companies" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-bg-muted/70">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Azienda</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Contatti</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Email</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Telefono</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Posizione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className="group transition-colors hover:bg-bg-muted/60"
                    onClick={() => setSelectedCompany(company)}
                  >
                    <td className="px-6 py-4">
                      <button type="button" className="text-left">
                        <span className="block text-sm font-bold text-brand-primary">{company.name}</span>
                        <span className="block text-xs text-text-muted">{company.isHeadquarters ? "Sede principale" : company.vatNumber || "Sede"}</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{companyClients(company.id).length}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{company.email || "-"}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{company.phone || "-"}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {[company.city, company.province, company.country].filter(Boolean).join(", ") || "-"}
                    </td>
                  </tr>
                ))}
                {!filteredCompanies.length ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                      Nessuna azienda trovata.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-bg-muted/70">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted",
                      column.key === visibleColumns[visibleColumns.length - 1]?.key ? "text-right" : "text-left",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border-subtle">
              {paginatedClients.map((client) => (
                <tr key={client.id} className="group transition-colors hover:bg-bg-muted/60" onClick={() => setSelectedClient(client)}>
                  {visibleColumns.map((column) => (
                    <td key={`${client.id}-${column.key}`} className={cn("px-6 py-4", column.cellClassName)}>
                      {column.key === "actions" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(APP_ROUTES.clientEdit(client.id));
                            }}
                            className="rounded-lg p-1.5 text-brand-primary transition-colors hover:bg-bg-subtle"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(client);
                            }}
                            className="rounded-lg p-1.5 text-status-danger-text transition-colors hover:bg-status-danger-bg"
                          >
                            <Trash2 size={18} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedClient(client);
                            }}
                            className="group/arrow rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-subtle hover:text-brand-primary"
                          >
                            <ArrowRight size={18} className="transition-transform group-hover/arrow:translate-x-0.5" />
                          </button>
                        </div>
                      ) : (
                        column.render(client)
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {isLoading && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Caricamento clienti in corso...
                  </td>
                </tr>
              )}

              {!isLoading && !filteredClients.length && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Nessun cliente trovato con i filtri attivi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        {activeRegistry === "clients" ? (
        <div className="flex flex-col items-start justify-between gap-3 border-t border-border-subtle p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-text-muted">
              {firstVisibleRow} - {lastVisibleRow} su {filteredClients.length} clienti
            </p>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <span>vista</span>
              <SelectDropdown
                size="sm"
                value={String(rowsPerPage)}
                onChange={(value) => setRowsPerPage(Number(value))}
                options={ROWS_PER_PAGE_OPTIONS.map((option) => ({
                  value: String(option),
                  label: String(option),
                }))}
                className="min-w-[72px]"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={!canGoPrevious}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-medium",
                canGoPrevious
                  ? "border-border-default text-text-secondary hover:bg-bg-subtle"
                  : "cursor-not-allowed border-border-default bg-bg-muted text-text-muted",
              )}
            >
              Precedente
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={!canGoNext}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-medium",
                canGoNext
                  ? "border-brand-primary text-brand-primary hover:bg-status-info-bg"
                  : "cursor-not-allowed border-border-default bg-bg-muted text-text-muted",
              )}
            >
              Successivo
            </button>
          </div>
        </div>
        ) : null}
      </Card>
      {selectedClient ? (
        <RegistryDialog title={selectedClient.name} onClose={() => setSelectedClient(null)}>
          <DetailGrid
            items={[
              ["Azienda", selectedClient.companyName || "-"],
              ["Ruolo", selectedClient.role || "-"],
              ["Reparto", selectedClient.department || "-"],
              ["Email", selectedClient.email || "-"],
              ["Telefono", selectedClient.phone || "-"],
              ["Cellulare", selectedClient.mobile || "-"],
              ["Posizione", [selectedClient.city, selectedClient.province, selectedClient.country].filter(Boolean).join(", ") || "-"],
              ["Indirizzo", selectedClient.address || "-"],
              ["Note", selectedClient.notes || "-"],
            ]}
          />
        </RegistryDialog>
      ) : null}
      {selectedCompany ? (
        <RegistryDialog title={selectedCompany.name} onClose={() => setSelectedCompany(null)}>
          <DetailGrid
            items={[
              ["Tipo sede", selectedCompany.isHeadquarters ? "Sede principale" : "Sede secondaria"],
              ["P. IVA", selectedCompany.vatNumber || "-"],
              ["Codice fiscale", selectedCompany.taxCode || "-"],
              ["Email", selectedCompany.email || "-"],
              ["Telefono", selectedCompany.phone || "-"],
              ["Website", selectedCompany.website || "-"],
              ["Indirizzo", [selectedCompany.address, selectedCompany.postalCode, selectedCompany.city, selectedCompany.province, selectedCompany.country].filter(Boolean).join(", ") || "-"],
              ["Coordinate", selectedCompany.latitude && selectedCompany.longitude ? `${selectedCompany.latitude}, ${selectedCompany.longitude}` : "-"],
              ["Note", selectedCompany.notes || "-"],
            ]}
          />
          <div className="mt-5 border-t border-border-subtle pt-4">
            <h3 className="text-sm font-bold text-text-primary">Clienti collegati</h3>
            <div className="mt-2 space-y-2">
              {companyClients(selectedCompany.id).map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    setSelectedCompany(null);
                    setSelectedClient(client);
                  }}
                  className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-border-subtle bg-bg-page px-3 py-2 text-left text-sm hover:bg-bg-muted"
                >
                  <span className="font-semibold text-text-primary">{client.name}</span>
                  <span className="text-xs text-text-muted">{client.role || client.email || "-"}</span>
                </button>
              ))}
              {!companyClients(selectedCompany.id).length ? (
                <p className="rounded-[var(--radius-md)] border border-dashed border-border-default px-3 py-3 text-sm text-text-muted">
                  Nessun cliente collegato a questa azienda.
                </p>
              ) : null}
            </div>
          </div>
        </RegistryDialog>
      ) : null}
      {isCompanyDialogOpen ? (
        <RegistryDialog title="Nuova azienda" onClose={() => setIsCompanyDialogOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveCompany();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {COMPANY_FORM_FIELDS.map((field) => (
                <label key={field.key} className={cn("block space-y-1.5", field.wide && "md:col-span-2")}>
                  <span className="text-sm font-bold text-text-primary">{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      value={companyForm[field.key]}
                      onChange={(event) => updateCompanyField(field.key, event.target.value)}
                      className="min-h-24 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                    />
                  ) : (
                    <Input
                      value={companyForm[field.key]}
                      onChange={(event) => updateCompanyField(field.key, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-bg-page px-3 py-2.5 text-sm font-semibold text-text-primary">
              <CheckboxControl
                type="checkbox"
                checked={companyForm.isHeadquarters}
                onChange={(event) => setCompanyForm((current) => ({ ...current, isHeadquarters: event.target.checked }))}
              />
              Sede principale
            </label>
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-page p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-primary">Posizione sulla mappa</p>
                  <p className="mt-1 truncate text-xs text-text-muted">
                    {geocodedAddress || "Completa indirizzo e citta, poi cerca la posizione."}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => void geocodeCompany()} disabled={isGeocodingCompany || isSavingCompany}>
                  <MapPin size={16} />
                  {isGeocodingCompany ? "Ricerca..." : "Trova posizione"}
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCompanyDialogOpen(false)} disabled={isSavingCompany}>
                Annulla
              </Button>
              <Button type="submit" disabled={isSavingCompany}>
                Salva azienda
              </Button>
            </div>
          </form>
        </RegistryDialog>
      ) : null}
      {isClientDialogOpen ? (
        <RegistryDialog title="Nuovo cliente" onClose={() => setIsClientDialogOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveClient();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-bold text-text-primary">Nome cliente</span>
                <Input
                  value={clientForm.name}
                  onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-bold text-text-primary">Azienda</span>
                <select
                  value={clientForm.companyId}
                  onChange={(event) => setClientForm((current) => ({ ...current, companyId: event.target.value }))}
                  className="h-11 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-3 text-sm text-text-secondary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                >
                  <option value="">Nessuna azienda collegata</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} - {company.isHeadquarters ? "sede principale" : [company.city, company.province].filter(Boolean).join(", ") || "sede"}
                    </option>
                  ))}
                </select>
              </label>
              {CLIENT_FORM_FIELDS.map((field) => (
                <label key={field.key} className={cn("block space-y-1.5", field.wide && "md:col-span-2")}>
                  <span className="text-sm font-bold text-text-primary">{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      value={clientForm[field.key]}
                      onChange={(event) => setClientForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="min-h-24 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                    />
                  ) : (
                    <Input
                      type={field.type}
                      value={clientForm[field.key]}
                      onChange={(event) => setClientForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
              <Button type="button" variant="outline" onClick={() => setIsClientDialogOpen(false)} disabled={isSavingClient}>
                Annulla
              </Button>
              <Button type="submit" disabled={isSavingClient}>
                Salva cliente
              </Button>
            </div>
          </form>
        </RegistryDialog>
      ) : null}
    </div>
  );
}

const COMPANY_FORM_FIELDS: Array<{
  key: CompanyTextFieldKey;
  label: string;
  multiline?: boolean;
  wide?: boolean;
}> = [
  { key: "name", label: "Nome azienda" },
  { key: "vatNumber", label: "Partita IVA" },
  { key: "taxCode", label: "Codice fiscale" },
  { key: "website", label: "Sito web" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefono" },
  { key: "address", label: "Indirizzo", wide: true },
  { key: "postalCode", label: "CAP" },
  { key: "city", label: "Città" },
  { key: "province", label: "Provincia" },
  { key: "country", label: "Paese" },
  { key: "notes", label: "Note", multiline: true, wide: true },
];

const CLIENT_FORM_FIELDS: Array<{
  key: Exclude<keyof ClientFormState, "companyId">;
  label: string;
  multiline?: boolean;
  type?: "email" | "tel" | "text";
  wide?: boolean;
}> = [
  { key: "role", label: "Ruolo" },
  { key: "department", label: "Reparto" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Telefono", type: "tel" },
  { key: "mobile", label: "Cellulare", type: "tel" },
  { key: "address", label: "Indirizzo", wide: true },
  { key: "city", label: "Citta" },
  { key: "province", label: "Provincia" },
  { key: "country", label: "Paese" },
  { key: "notes", label: "Note", multiline: true, wide: true },
];

function RegistryDialog({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-[var(--radius-lg)] border border-border-default bg-bg-surface shadow-elevated" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle p-4">
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-text-muted transition-colors hover:bg-bg-muted hover:text-text-primary"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(86vh-4.5rem)] overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function DetailGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className={cn("rounded-[var(--radius-md)] border border-border-subtle bg-bg-page px-3 py-2", label === "Note" && "md:col-span-2")}>
          <p className="text-xs font-bold uppercase text-text-muted">{label}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-text-primary">{value}</p>
        </div>
      ))}
    </div>
  );
}

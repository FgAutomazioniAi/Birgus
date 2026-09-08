"use client";

import { ArrowLeft, Building2, Mail, MapPin, Phone, Save, UserRound, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { FormField, PageHelpHint } from "@/components/molecules";
import { APP_ROUTES } from "@/lib/routes";
import type { Company } from "@/lib/types";

interface ClientFormValues {
  address: string;
  city: string;
  companyId: string;
  country: string;
  department: string;
  email: string;
  mobile: string;
  name: string;
  notes: string;
  phone: string;
  province: string;
  role: string;
}

interface ClientApiDetail extends Omit<ClientFormValues, "companyId"> {
  companyId: number | null;
  id: string;
}

export interface ClientFormProps {
  id?: string;
}

export function ClientForm({ id }: ClientFormProps) {
  const router = useRouter();
  const isEdit = Boolean(id);
  const [clientId, setClientId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    defaultValues: {
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
      country: "",
      notes: "",
    },
  });

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await fetch("/api/companies", { cache: "no-store" });
        if (!response.ok) return;
        setCompanies(await response.json() as Company[]);
      } catch {
        setCompanies([]);
      }
    };

    void loadCompanies();
  }, []);

  useEffect(() => {
    if (!isEdit || !id) {
      setIsLoading(false);
      return;
    }

    const loadClient = async () => {
      try {
        const response = await fetch(`/api/clients/${id}`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Cliente non trovato");
        }

        const client = await response.json() as ClientApiDetail;
        setClientId(client.id);
        reset({
          name: client.name,
          companyId: client.companyId ? String(client.companyId) : "",
          role: client.role ?? "",
          department: client.department ?? "",
          email: client.email,
          phone: client.phone,
          mobile: client.mobile ?? "",
          address: client.address ?? "",
          city: client.city ?? "",
          province: client.province ?? "",
          country: client.country ?? "",
          notes: client.notes,
        });
      } catch {
        toast.error("Impossibile caricare i dati del cliente.");
        router.push(APP_ROUTES.clients);
      } finally {
        setIsLoading(false);
      }
    };

    void loadClient();
  }, [id, isEdit, reset, router]);

  const onSubmit = async (data: ClientFormValues) => {
    try {
      setIsSubmitting(true);

      const endpoint = isEdit && id ? `/api/clients/${id}` : "/api/clients";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          companyId: data.companyId ? Number(data.companyId) : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Errore salvataggio cliente");
      }

      toast.success(isEdit ? "Cliente aggiornato con successo." : "Cliente creato con successo.");
      router.push(APP_ROUTES.clients);
      router.refresh();
    } catch {
      toast.error("Salvataggio cliente non riuscito.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(APP_ROUTES.clients)}
            className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-2 text-text-secondary shadow-card transition-colors hover:bg-bg-muted hover:text-brand-primary"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Text as="h1" variant="h1">
                {isEdit ? "Modifica cliente" : "Nuovo cliente"}
              </Text>
              <PageHelpHint text="Compila i dati anagrafici, aziendali e di contatto." />
            </div>
            <Text variant="muted">
              {isEdit ? "Aggiorna i dati del cliente" : "Inserisci un nuovo cliente collegabile a un'azienda"}
            </Text>
          </div>
        </div>

        {isEdit && (
          <div className="hidden items-center gap-2 rounded-[var(--radius-md)] border border-border-default bg-status-info-bg px-3 py-1 text-xs font-bold text-status-info-text sm:flex">
            ID cliente: <span className="font-mono text-[10px]">{clientId ?? "-"}</span>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-6 lg:p-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-10">
            <FormField label="Nome cliente" icon={<UserRound size={18} className="text-brand-primary" />} error={errors.name?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("name", { required: "Il nome cliente è obbligatorio" })} />
            </FormField>

            <FormField label="Azienda" icon={<Building2 size={18} className="text-brand-primary" />}>
              <select
                disabled={isLoading || isSubmitting}
                className="h-11 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-3 text-sm text-text-secondary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                {...register("companyId")}
              >
                <option value="">Nessuna azienda collegata</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-10">
            <FormField label="Ruolo" error={errors.role?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("role")} />
            </FormField>
            <FormField label="Reparto" error={errors.department?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("department")} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-10">
            <FormField label="Email" icon={<Mail size={18} className="text-brand-primary" />} error={errors.email?.message}>
              <Input type="email" disabled={isLoading || isSubmitting} {...register("email")} />
            </FormField>
            <FormField label="Telefono" icon={<Phone size={18} className="text-brand-primary" />} error={errors.phone?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("phone")} />
            </FormField>
            <FormField label="Cellulare" icon={<Phone size={18} className="text-brand-primary" />} error={errors.mobile?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("mobile")} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-10">
            <FormField label="Indirizzo" icon={<MapPin size={18} className="text-brand-primary" />} error={errors.address?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("address")} />
            </FormField>
            <FormField label="Città" error={errors.city?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("city")} />
            </FormField>
            <FormField label="Provincia" error={errors.province?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("province")} />
            </FormField>
            <FormField label="Paese" error={errors.country?.message}>
              <Input type="text" disabled={isLoading || isSubmitting} {...register("country")} />
            </FormField>
          </div>

          <FormField label="Note" error={errors.notes?.message}>
            <textarea
              {...register("notes")}
              disabled={isLoading || isSubmitting}
              className="min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
          </FormField>

          <div className="flex flex-col items-center justify-end gap-3 pt-2 sm:flex-row">
            <Button
              variant="outline"
              className="h-12 w-full rounded-[var(--radius-md)] px-6 py-3 text-text-muted sm:w-auto"
              onClick={() => router.push(APP_ROUTES.clients)}
              disabled={isSubmitting}
            >
              <XCircle size={18} />
              Annulla
            </Button>

            <Button type="submit" className="h-12 w-full rounded-[var(--radius-md)] px-8 py-3 sm:w-auto" disabled={isSubmitting}>
              <Save size={18} />
              {isEdit ? "Salva modifiche" : "Crea cliente"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

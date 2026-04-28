"use client";

import { ArrowLeft, Mail, Phone, Save, UserRound, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { APP_ROUTES } from "@/lib/routes";

interface ClientFormValues {
  email: string;
  name: string;
  notes: string;
  phone: string;
}

interface ClientApiDetail extends ClientFormValues {
  id: string;
}

export interface ClientFormProps {
  id?: string;
}

export function ClientForm({ id }: ClientFormProps) {
  const router = useRouter();
  const isEdit = Boolean(id);
  const [clientId, setClientId] = useState<string | null>(null);
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
      email: "",
      phone: "",
      notes: "",
    },
  });

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

        const client = (await response.json()) as ClientApiDetail;
        setClientId(client.id);
        reset({
          name: client.name,
          email: client.email,
          phone: client.phone,
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
        body: JSON.stringify(data),
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(APP_ROUTES.clients)}
            className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-2 text-text-secondary shadow-card transition-colors hover:bg-bg-muted hover:text-brand-primary"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <Text as="h1" variant="h1">
              {isEdit ? "Modifica Cliente" : "Nuovo Cliente"}
            </Text>
            <Text variant="muted">
              {isEdit ? "Aggiorna i dati anagrafici del cliente" : "Inserisci un nuovo cliente"}
            </Text>
          </div>
        </div>

        {isEdit && (
          <div className="hidden items-center gap-2 rounded-lg border border-blue-100 bg-status-info-bg px-3 py-1 text-xs font-bold text-status-info-text sm:flex">
            ID cliente: <span className="font-mono text-[10px]">{clientId ?? "-"}</span>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-6 lg:p-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-10">
            <FormField label="Nome Cliente" icon={<UserRound size={18} className="text-brand-primary" />} error={errors.name?.message}>
              <Input
                type="text"
                placeholder="Inserisci il nome cliente..."
                disabled={isLoading || isSubmitting}
                {...register("name", { required: "Il nome cliente e obbligatorio" })}
              />
            </FormField>

            <FormField label="Email" icon={<Mail size={18} className="text-brand-primary" />} error={errors.email?.message}>
              <Input
                type="email"
                placeholder="Inserisci l'email..."
                disabled={isLoading || isSubmitting}
                {...register("email", { required: "L'email e obbligatoria" })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-10">
            <FormField label="Telefono" icon={<Phone size={18} className="text-brand-primary" />} error={errors.phone?.message}>
              <Input
                type="text"
                placeholder="Inserisci il numero di telefono..."
                disabled={isLoading || isSubmitting}
                {...register("phone", { required: "Il numero di telefono e obbligatorio" })}
              />
            </FormField>

            <FormField label="Note" error={errors.notes?.message}>
              <textarea
                {...register("notes", { required: "Le note sono obbligatorie" })}
                disabled={isLoading || isSubmitting}
                placeholder="Inserisci note operative o commerciali..."
                className="min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              />
            </FormField>
          </div>

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

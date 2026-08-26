import { randomBytes, scrypt } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { DEFAULT_MODULE_AGENT_PROMPTS } from "../src/modules/agents/domain/DefaultModuleAgentPrompts.js";

const prisma = new PrismaClient();

const MODULE_KEYS = [
  "project_management",
  "agent_management",
  "shipment_management",
  "ddt_processing",
  "measure_report",
  "document_archive",
  "document_intelligence",
  "conversational_assistant",
  "workflow_management",
  "customer_map",
  "offer_priority",
  "maintenance_proposals",
  "maintenance_calendar",
  "notification_center",
  "audit_center",
  "superadmin_center",
] as const;

const ROLE_KEYS = ["superadmin", "admin", "operator"] as const;

const PERMISSION_KEYS = [
  "modules.read",
  "modules.configure",
  "projects.read",
  "projects.write",
  "agents.read",
  "agents.write",
  "clients.read",
  "clients.write",
  "documents.read",
  "documents.write",
  "shipments.read",
  "shipments.write",
  "ddt.read",
  "ddt.process",
  "measure_report.read",
  "measure_report.process",
  "knowledge.read",
  "knowledge.write",
  "assistant.read",
  "assistant.write",
  "assistant.configure",
  "workflows.read",
  "workflows.write",
  "workflows.configure",
  "customer_map.read",
  "customer_map.write",
  "offer_priority.read",
  "offer_priority.write",
  "maintenance_proposals.read",
  "maintenance_proposals.write",
  "maintenance_calendar.read",
  "maintenance_calendar.write",
  "notifications.read",
  "notifications.write",
  "audit.read",
] as const;

const ROLE_PERMISSION_MATRIX: Record<(typeof ROLE_KEYS)[number], readonly (typeof PERMISSION_KEYS)[number][]> = {
  superadmin: PERMISSION_KEYS,
  admin: [
    "modules.read",
    "modules.configure",
    "projects.read",
    "projects.write",
    "agents.read",
    "agents.write",
    "clients.read",
    "clients.write",
    "documents.read",
    "documents.write",
    "shipments.read",
    "shipments.write",
    "ddt.read",
    "ddt.process",
    "measure_report.read",
    "measure_report.process",
    "knowledge.read",
    "knowledge.write",
    "assistant.read",
    "assistant.write",
    "assistant.configure",
    "workflows.read",
    "workflows.write",
    "workflows.configure",
    "customer_map.read",
    "customer_map.write",
    "offer_priority.read",
    "offer_priority.write",
    "maintenance_proposals.read",
    "maintenance_proposals.write",
    "maintenance_calendar.read",
    "maintenance_calendar.write",
    "notifications.read",
    "notifications.write",
  ],
  operator: [
    "modules.read",
    "projects.read",
    "projects.write",
    "agents.read",
    "agents.write",
    "clients.read",
    "clients.write",
    "documents.read",
    "documents.write",
    "shipments.read",
    "shipments.write",
    "ddt.read",
    "ddt.process",
    "measure_report.read",
    "measure_report.process",
    "knowledge.read",
    "assistant.read",
    "assistant.write",
    "workflows.read",
    "customer_map.read",
    "offer_priority.read",
    "maintenance_proposals.read",
    "maintenance_calendar.read",
    "notifications.read",
  ],
} as const;

const PROJECT_STATUSES = [
  { key: "in_revisione", label: "In Revisione" },
  { key: "completato", label: "Completato" },
  { key: "in_attesa", label: "In Attesa" },
] as const;

const SHIPMENT_STATUSES = [
  { key: "draft", label: "Bozza" },
  { key: "prepared", label: "Preparata" },
  { key: "shipped", label: "Spedita" },
  { key: "delivered", label: "Consegnata" },
] as const;

const FILE_TYPES = [
  { key: "pdf", mimeType: "application/pdf" },
  { key: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { key: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
] as const;

const FILE_STATUSES = ["uploaded", "reviewed", "approved"] as const;

const normalizePassword = (password: string) => password.normalize("NFKC");

const deriveScryptHash = async (password: string, salt: string, keyLength: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, { N: 16384, p: 1, r: 8 }, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(derivedKey));
    });
  });

async function hashPassword(password: string): Promise<string> {
  const pepper = process.env.AUTH_PEPPER ?? "";
  const salt = randomBytes(16).toString("base64url");
  const derived = await deriveScryptHash(normalizePassword(password) + pepper, salt, 64);
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

function readSeedPassword(): string {
  const password = process.env.BIRGUS_SEED_PASSWORD?.trim() ?? "";
  if (password.length < 12) {
    throw new Error("BIRGUS_SEED_PASSWORD is required and must be at least 12 characters.");
  }

  return password;
}

async function seedOperationsDemoData(workspaceId: string): Promise<void> {
  const sourceSystem = "demo_seed";

  const customers = await Promise.all([
    prisma.operationalCustomer.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "customer-veneta-packaging",
        },
      },
      update: {
        name: "Veneta Packaging S.p.A.",
        email: "ufficio.tecnico@venetapackaging.example",
        phone: "+39 0423 000001",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        source_system: sourceSystem,
        external_id: "customer-veneta-packaging",
        name: "Veneta Packaging S.p.A.",
        email: "ufficio.tecnico@venetapackaging.example",
        phone: "+39 0423 000001",
      },
    }),
    prisma.operationalCustomer.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "customer-nord-meccanica",
        },
      },
      update: {
        name: "Nord Meccanica S.r.l.",
        email: "acquisti@nordmeccanica.example",
        phone: "+39 0437 000002",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        source_system: sourceSystem,
        external_id: "customer-nord-meccanica",
        name: "Nord Meccanica S.r.l.",
        email: "acquisti@nordmeccanica.example",
        phone: "+39 0437 000002",
      },
    }),
    prisma.operationalCustomer.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "customer-alpina-food",
        },
      },
      update: {
        name: "Alpina Food S.p.A.",
        email: "maintenance@alpinafood.example",
        phone: "+39 0445 000003",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        source_system: sourceSystem,
        external_id: "customer-alpina-food",
        name: "Alpina Food S.p.A.",
        email: "maintenance@alpinafood.example",
        phone: "+39 0445 000003",
      },
    }),
  ]);

  const [veneta, nord, alpina] = customers;

  await Promise.all([
    prisma.customerAddress.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "address-veneta-main",
        },
      },
      update: {
        customer_id: veneta.id,
        label: "Sede produttiva",
        address_line_1: "Via dell'Industria, 18",
        postal_code: "31044",
        city: "Montebelluna",
        province: "TV",
        country: "IT",
        geocoding_status: "SUCCESS",
        latitude: "45.7751000",
        longitude: "12.0453000",
        geocoding_provider: "demo",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        customer_id: veneta.id,
        source_system: sourceSystem,
        external_id: "address-veneta-main",
        label: "Sede produttiva",
        address_line_1: "Via dell'Industria, 18",
        postal_code: "31044",
        city: "Montebelluna",
        province: "TV",
        country: "IT",
        geocoding_query: "Via dell'Industria 18, Montebelluna, Italia",
        geocoding_status: "SUCCESS",
        latitude: "45.7751000",
        longitude: "12.0453000",
        geocoding_provider: "demo",
        last_geocoded_at: new Date("2026-08-01T08:00:00.000Z"),
      },
    }),
    prisma.customerAddress.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "address-nord-main",
        },
      },
      update: {
        customer_id: nord.id,
        label: "Stabilimento",
        address_line_1: "Zona Industriale, 7",
        postal_code: "32100",
        city: "Belluno",
        province: "BL",
        country: "IT",
        geocoding_status: "SUCCESS",
        latitude: "46.1392000",
        longitude: "12.2167000",
        geocoding_provider: "demo",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        customer_id: nord.id,
        source_system: sourceSystem,
        external_id: "address-nord-main",
        label: "Stabilimento",
        address_line_1: "Zona Industriale, 7",
        postal_code: "32100",
        city: "Belluno",
        province: "BL",
        country: "IT",
        geocoding_query: "Zona Industriale 7, Belluno, Italia",
        geocoding_status: "SUCCESS",
        latitude: "46.1392000",
        longitude: "12.2167000",
        geocoding_provider: "demo",
        last_geocoded_at: new Date("2026-08-01T08:05:00.000Z"),
      },
    }),
    prisma.customerAddress.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "address-alpina-main",
        },
      },
      update: {
        customer_id: alpina.id,
        label: "Linea confezionamento",
        address_line_1: "Via Pasubio, 42",
        postal_code: "36015",
        city: "Schio",
        province: "VI",
        country: "IT",
        geocoding_status: "SUCCESS",
        latitude: "45.7128000",
        longitude: "11.3569000",
        geocoding_provider: "demo",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        customer_id: alpina.id,
        source_system: sourceSystem,
        external_id: "address-alpina-main",
        label: "Linea confezionamento",
        address_line_1: "Via Pasubio, 42",
        postal_code: "36015",
        city: "Schio",
        province: "VI",
        country: "IT",
        geocoding_query: "Via Pasubio 42, Schio, Italia",
        geocoding_status: "SUCCESS",
        latitude: "45.7128000",
        longitude: "11.3569000",
        geocoding_provider: "demo",
        last_geocoded_at: new Date("2026-08-01T08:10:00.000Z"),
      },
    }),
  ]);

  const workReferences = await Promise.all([
    prisma.operationalWorkReference.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "work-comm-24017",
        },
      },
      update: {
        customer_id: veneta.id,
        code: "COMM-24017",
        name: "Linea imballaggio cartoni",
        category: "impianto",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        customer_id: veneta.id,
        source_system: sourceSystem,
        external_id: "work-comm-24017",
        code: "COMM-24017",
        name: "Linea imballaggio cartoni",
        category: "impianto",
        started_at: new Date("2024-02-12T00:00:00.000Z"),
      },
    }),
    prisma.operationalWorkReference.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "work-comm-25008",
        },
      },
      update: {
        customer_id: nord.id,
        code: "COMM-25008",
        name: "Revamping quadro automazione",
        category: "lavorazione",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        customer_id: nord.id,
        source_system: sourceSystem,
        external_id: "work-comm-25008",
        code: "COMM-25008",
        name: "Revamping quadro automazione",
        category: "lavorazione",
        started_at: new Date("2025-01-20T00:00:00.000Z"),
      },
    }),
    prisma.operationalWorkReference.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "work-comm-23041",
        },
      },
      update: {
        customer_id: alpina.id,
        code: "COMM-23041",
        name: "Confezionatrice verticale",
        category: "impianto",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        customer_id: alpina.id,
        source_system: sourceSystem,
        external_id: "work-comm-23041",
        code: "COMM-23041",
        name: "Confezionatrice verticale",
        category: "impianto",
        started_at: new Date("2023-05-08T00:00:00.000Z"),
      },
    }),
  ]);

  const [venetaWork, nordWork, alpinaWork] = workReferences;

  const offers = await Promise.all([
    prisma.commercialOffer.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "offer-ric-226",
        },
      },
      update: {
        customer_id: veneta.id,
        work_reference_id: venetaWork.id,
        offer_code: "RIC/226",
        status: "In corso",
        subject: "Ricambi e kit manutenzione linea imballaggio",
        total_amount: "18450.00",
        issued_at: new Date("2026-05-18T00:00:00.000Z"),
        competence: "Service",
        conversion_rate: "0.3750",
        priority_score: "0.82000",
        priority_band: "HIGH",
        abc_class: "A",
        cumulative_share: "0.47000",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        customer_id: veneta.id,
        work_reference_id: venetaWork.id,
        source_system: sourceSystem,
        external_id: "offer-ric-226",
        offer_code: "RIC/226",
        offer_number: "226",
        offer_series: "RIC",
        status: "In corso",
        subject: "Ricambi e kit manutenzione linea imballaggio",
        total_amount: "18450.00",
        issued_at: new Date("2026-05-18T00:00:00.000Z"),
        competence: "Service",
        conversion_rate: "0.3750",
        priority_score: "0.82000",
        priority_band: "HIGH",
        abc_class: "A",
        cumulative_share: "0.47000",
      },
    }),
    prisma.commercialOffer.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "offer-aut-104",
        },
      },
      update: {
        customer_id: nord.id,
        work_reference_id: nordWork.id,
        offer_code: "AUT/104",
        status: "In corso",
        subject: "Upgrade supervisione PLC e HMI",
        total_amount: "12600.00",
        issued_at: new Date("2026-04-09T00:00:00.000Z"),
        competence: "Automation",
        conversion_rate: "0.5200",
        priority_score: "0.64000",
        priority_band: "MEDIUM",
        abc_class: "B",
        cumulative_share: "0.79000",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        customer_id: nord.id,
        work_reference_id: nordWork.id,
        source_system: sourceSystem,
        external_id: "offer-aut-104",
        offer_code: "AUT/104",
        offer_number: "104",
        offer_series: "AUT",
        status: "In corso",
        subject: "Upgrade supervisione PLC e HMI",
        total_amount: "12600.00",
        issued_at: new Date("2026-04-09T00:00:00.000Z"),
        competence: "Automation",
        conversion_rate: "0.5200",
        priority_score: "0.64000",
        priority_band: "MEDIUM",
        abc_class: "B",
        cumulative_share: "0.79000",
      },
    }),
  ]);

  const [venetaOffer, nordOffer] = offers;

  await Promise.all([
    prisma.commercialOfferLine.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "line-ric-226-1",
        },
      },
      update: {
        offer_id: venetaOffer.id,
        line_number: 1,
        item_code: "KIT-MAN-450",
        description: "Kit manutenzione rulli e cinghie",
        quantity: "2.000",
        unit_price: "3850.00",
        total_amount: "7700.00",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        offer_id: venetaOffer.id,
        source_system: sourceSystem,
        external_id: "line-ric-226-1",
        line_number: 1,
        item_code: "KIT-MAN-450",
        description: "Kit manutenzione rulli e cinghie",
        quantity: "2.000",
        unit_price: "3850.00",
        total_amount: "7700.00",
      },
    }),
    prisma.commercialOfferLine.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "line-ric-226-2",
        },
      },
      update: {
        offer_id: venetaOffer.id,
        line_number: 2,
        item_code: "SVC-START",
        description: "Intervento tecnico programmato",
        quantity: "3.000",
        unit_price: "950.00",
        total_amount: "2850.00",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        offer_id: venetaOffer.id,
        source_system: sourceSystem,
        external_id: "line-ric-226-2",
        line_number: 2,
        item_code: "SVC-START",
        description: "Intervento tecnico programmato",
        quantity: "3.000",
        unit_price: "950.00",
        total_amount: "2850.00",
      },
    }),
    prisma.commercialOfferLine.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "line-aut-104-1",
        },
      },
      update: {
        offer_id: nordOffer.id,
        line_number: 1,
        item_code: "PLC-UPG",
        description: "Upgrade PLC safety e diagnostica",
        quantity: "1.000",
        unit_price: "7600.00",
        total_amount: "7600.00",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        offer_id: nordOffer.id,
        source_system: sourceSystem,
        external_id: "line-aut-104-1",
        line_number: 1,
        item_code: "PLC-UPG",
        description: "Upgrade PLC safety e diagnostica",
        quantity: "1.000",
        unit_price: "7600.00",
        total_amount: "7600.00",
      },
    }),
  ]);

  await Promise.all([
    prisma.maintenanceProposal.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "proposal-veneta-2026-09",
        },
      },
      update: {
        work_reference_id: venetaWork.id,
        customer_name_snapshot: veneta.name,
        work_reference_snapshot: venetaWork.name,
        last_service_at: new Date("2026-02-14T00:00:00.000Z"),
        suggested_at: new Date("2026-09-08T00:00:00.000Z"),
        estimated_frequency_days: 180,
        historical_events_count: 5,
        historical_work_minutes: 1860,
        preferred_operator: "Alberto Libertini",
        annual_plan_hint: "Settembre, settimana 37",
        urgency: "DUE_SOON",
        reason: "Storico manutenzioni semestrale e ultima visita oltre 170 giorni fa.",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        work_reference_id: venetaWork.id,
        source_system: sourceSystem,
        external_id: "proposal-veneta-2026-09",
        customer_name_snapshot: veneta.name,
        work_reference_snapshot: venetaWork.name,
        last_service_at: new Date("2026-02-14T00:00:00.000Z"),
        suggested_at: new Date("2026-09-08T00:00:00.000Z"),
        estimated_frequency_days: 180,
        historical_events_count: 5,
        historical_work_minutes: 1860,
        preferred_operator: "Alberto Libertini",
        annual_plan_hint: "Settembre, settimana 37",
        urgency: "DUE_SOON",
        reason: "Storico manutenzioni semestrale e ultima visita oltre 170 giorni fa.",
      },
    }),
    prisma.maintenanceProposal.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "proposal-alpina-2026-08",
        },
      },
      update: {
        work_reference_id: alpinaWork.id,
        customer_name_snapshot: alpina.name,
        work_reference_snapshot: alpinaWork.name,
        last_service_at: new Date("2025-12-12T00:00:00.000Z"),
        suggested_at: new Date("2026-08-28T00:00:00.000Z"),
        estimated_frequency_days: 210,
        historical_events_count: 4,
        historical_work_minutes: 1320,
        preferred_operator: "Marco R.",
        annual_plan_hint: "Agosto, settimana 35",
        urgency: "OVERDUE",
        reason: "La cadenza stimata indica manutenzione gia in scadenza.",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        work_reference_id: alpinaWork.id,
        source_system: sourceSystem,
        external_id: "proposal-alpina-2026-08",
        customer_name_snapshot: alpina.name,
        work_reference_snapshot: alpinaWork.name,
        last_service_at: new Date("2025-12-12T00:00:00.000Z"),
        suggested_at: new Date("2026-08-28T00:00:00.000Z"),
        estimated_frequency_days: 210,
        historical_events_count: 4,
        historical_work_minutes: 1320,
        preferred_operator: "Marco R.",
        annual_plan_hint: "Agosto, settimana 35",
        urgency: "OVERDUE",
        reason: "La cadenza stimata indica manutenzione gia in scadenza.",
      },
    }),
  ]);

  await Promise.all([
    prisma.maintenancePlanEntry.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "calendar-veneta-2026-09-08",
        },
      },
      update: {
        work_reference_id: venetaWork.id,
        title: "Manutenzione linea imballaggio",
        planned_start_at: new Date("2026-09-08T07:30:00.000Z"),
        planned_end_at: new Date("2026-09-08T15:30:00.000Z"),
        status: "PLANNED",
        assignee_name: "Alberto Libertini",
        note: "Verifica rulli, cinghie e fotocellule.",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        work_reference_id: venetaWork.id,
        source_system: sourceSystem,
        external_id: "calendar-veneta-2026-09-08",
        title: "Manutenzione linea imballaggio",
        planned_start_at: new Date("2026-09-08T07:30:00.000Z"),
        planned_end_at: new Date("2026-09-08T15:30:00.000Z"),
        status: "PLANNED",
        assignee_name: "Alberto Libertini",
        note: "Verifica rulli, cinghie e fotocellule.",
      },
    }),
    prisma.maintenancePlanEntry.upsert({
      where: {
        workspace_id_source_system_external_id: {
          workspace_id: workspaceId,
          source_system: sourceSystem,
          external_id: "calendar-alpina-2026-08-28",
        },
      },
      update: {
        work_reference_id: alpinaWork.id,
        title: "Controllo confezionatrice verticale",
        planned_start_at: new Date("2026-08-28T08:00:00.000Z"),
        planned_end_at: new Date("2026-08-28T12:00:00.000Z"),
        status: "CONFIRMED",
        assignee_name: "Marco R.",
        note: "Intervento prioritario da proposta scaduta.",
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        work_reference_id: alpinaWork.id,
        source_system: sourceSystem,
        external_id: "calendar-alpina-2026-08-28",
        title: "Controllo confezionatrice verticale",
        planned_start_at: new Date("2026-08-28T08:00:00.000Z"),
        planned_end_at: new Date("2026-08-28T12:00:00.000Z"),
        status: "CONFIRMED",
        assignee_name: "Marco R.",
        note: "Intervento prioritario da proposta scaduta.",
      },
    }),
  ]);
}

async function main() {
  const seedPassword = readSeedPassword();
  const organizationCode = "birgus";
  const workspaceCode = "main";

  const legacyAgentModule = await prisma.module.findUnique({
    where: { key: "project_agents" },
    select: { id: true },
  });

  if (legacyAgentModule) {
    await prisma.module.update({
      where: { id: legacyAgentModule.id },
      data: {
        key: "agent_management",
        name: "agent_management",
      },
    });
  }

  let organization = await prisma.organization.findUnique({
    where: { code: organizationCode },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        code: organizationCode,
        legal_name: "Birgus Platform",
      },
    });
  }

  let workspace = await prisma.workspace.findFirst({
    where: {
      organization_id: organization.id,
      code: workspaceCode,
    },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        organization_id: organization.id,
        code: workspaceCode,
        name: "Main Workspace",
      },
    });
  }

  for (const roleKey of ROLE_KEYS) {
    await prisma.role.upsert({
      where: { key: roleKey },
      update: { label: roleKey, is_system: true },
      create: { key: roleKey, label: roleKey, is_system: true },
    });
  }

  for (const permissionKey of PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key: permissionKey },
      update: { label: permissionKey },
      create: { key: permissionKey, label: permissionKey },
    });
  }

  const roles = await prisma.role.findMany({
    where: {
      key: {
        in: [...ROLE_KEYS],
      },
    },
  });

  const permissions = await prisma.permission.findMany({
    where: {
      key: {
        in: [...PERMISSION_KEYS],
      },
    },
  });

  const roleByKey = new Map(roles.map((item) => [item.key, item]));
  const permissionByKey = new Map(permissions.map((item) => [item.key, item]));

  for (const roleKey of ROLE_KEYS) {
    const role = roleByKey.get(roleKey);
    if (!role) {
      continue;
    }

    for (const permissionKey of ROLE_PERMISSION_MATRIX[roleKey]) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: role.id,
            permission_id: permission.id,
          },
        },
        update: {},
        create: {
          role_id: role.id,
          permission_id: permission.id,
        },
      });
    }
  }

  const superadminRole = roleByKey.get("superadmin");
  const adminRole = roleByKey.get("admin");
  const operatorRole = roleByKey.get("operator");
  if (!superadminRole || !adminRole || !operatorRole) {
    throw new Error("Required roles not found after seed role creation.");
  }

  for (const moduleKey of MODULE_KEYS) {
    await prisma.module.upsert({
      where: { key: moduleKey },
      update: { name: moduleKey, is_active: true },
      create: {
        key: moduleKey,
        name: moduleKey,
        is_active: true,
      },
    });
  }

  const deprecatedApiViewerModule = await prisma.module.findUnique({
    where: { key: "api_viewer" },
    select: { id: true },
  });

  if (deprecatedApiViewerModule) {
    await prisma.userModuleOverride.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.workspaceModule.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.moduleDependency.deleteMany({
      where: {
        OR: [
          { module_id: deprecatedApiViewerModule.id },
          { depends_on_module_id: deprecatedApiViewerModule.id },
        ],
      },
    });
    await prisma.moduleAgent.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.moduleTool.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.moduleWorkflow.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.module.delete({
      where: { id: deprecatedApiViewerModule.id },
    });
  }

  const modules = await prisma.module.findMany();
  for (const module of modules) {
    await prisma.workspaceModule.upsert({
      where: {
        workspace_id_module_id: {
          workspace_id: workspace.id,
          module_id: module.id,
        },
      },
      update: {
        is_enabled: true,
      },
      create: {
        workspace_id: workspace.id,
        module_id: module.id,
        is_enabled: true,
      },
    });
  }

  const moduleByKey = new Map(modules.map((item) => [item.key, item]));
  const projectManagementModule = moduleByKey.get("project_management");
  const agentManagementModule = moduleByKey.get("agent_management");
  const documentArchiveModule = moduleByKey.get("document_archive");
  const documentIntelligenceModule = moduleByKey.get("document_intelligence");
  const conversationalAssistantModule = moduleByKey.get("conversational_assistant");
  const workflowManagementModule = moduleByKey.get("workflow_management");
  const notificationCenterModule = moduleByKey.get("notification_center");
  const auditCenterModule = moduleByKey.get("audit_center");
  const superadminCenterModule = moduleByKey.get("superadmin_center");

  if (projectManagementModule && agentManagementModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: agentManagementModule.id,
          depends_on_module_id: projectManagementModule.id,
        },
      },
      update: {},
      create: {
        module_id: agentManagementModule.id,
        depends_on_module_id: projectManagementModule.id,
      },
    });
  }

  if (documentArchiveModule && documentIntelligenceModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: documentIntelligenceModule.id,
          depends_on_module_id: documentArchiveModule.id,
        },
      },
      update: {},
      create: {
        module_id: documentIntelligenceModule.id,
        depends_on_module_id: documentArchiveModule.id,
      },
    });
  }

  if (documentIntelligenceModule && conversationalAssistantModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: conversationalAssistantModule.id,
          depends_on_module_id: documentIntelligenceModule.id,
        },
      },
      update: {},
      create: {
        module_id: conversationalAssistantModule.id,
        depends_on_module_id: documentIntelligenceModule.id,
      },
    });
  }

  if (workflowManagementModule && agentManagementModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: workflowManagementModule.id,
          depends_on_module_id: agentManagementModule.id,
        },
      },
      update: {},
      create: {
        module_id: workflowManagementModule.id,
        depends_on_module_id: agentManagementModule.id,
      },
    });
  }

  if (workflowManagementModule && documentIntelligenceModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: workflowManagementModule.id,
          depends_on_module_id: documentIntelligenceModule.id,
        },
      },
      update: {},
      create: {
        module_id: workflowManagementModule.id,
        depends_on_module_id: documentIntelligenceModule.id,
      },
    });
  }

  if (auditCenterModule && notificationCenterModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: auditCenterModule.id,
          depends_on_module_id: notificationCenterModule.id,
        },
      },
      update: {},
      create: {
        module_id: auditCenterModule.id,
        depends_on_module_id: notificationCenterModule.id,
      },
    });
  }

  for (const status of PROJECT_STATUSES) {
    await prisma.projectStatus.upsert({
      where: {
        workspace_id_key: {
          workspace_id: workspace.id,
          key: status.key,
        },
      },
      update: {
        label: status.label,
      },
      create: {
        workspace_id: workspace.id,
        key: status.key,
        label: status.label,
      },
    });
  }

  for (const status of SHIPMENT_STATUSES) {
    await prisma.shipmentStatus.upsert({
      where: {
        workspace_id_key: {
          workspace_id: workspace.id,
          key: status.key,
        },
      },
      update: {
        label: status.label,
      },
      create: {
        workspace_id: workspace.id,
        key: status.key,
        label: status.label,
      },
    });
  }

  for (const revisionCode of ["v1", "v2"]) {
    await prisma.projectRevision.upsert({
      where: {
        workspace_id_code: {
          workspace_id: workspace.id,
          code: revisionCode,
        },
      },
      update: {},
      create: {
        workspace_id: workspace.id,
        code: revisionCode,
      },
    });
  }

  for (const fileType of FILE_TYPES) {
    await prisma.fileType.upsert({
      where: {
        key: fileType.key,
      },
      update: {
        mime_type: fileType.mimeType,
      },
      create: {
        key: fileType.key,
        mime_type: fileType.mimeType,
      },
    });
  }

  for (const fileStatus of FILE_STATUSES) {
    await prisma.fileStatus.upsert({
      where: {
        key: fileStatus,
      },
      update: {},
      create: {
        key: fileStatus,
      },
    });
  }

  const accountDefinitions = [
    {
      email: "samuel.m@fgautomazioni.it",
      firstName: "Samuel",
      lastName: "M",
      roleKey: "superadmin",
      roleId: superadminRole.id,
    },
    {
      email: "admin@birgus.it",
      firstName: "Birgus",
      lastName: "Admin",
      roleKey: "admin",
      roleId: adminRole.id,
    },
    {
      email: "guest@birgus.it",
      firstName: "Birgus",
      lastName: "Guest",
      roleKey: "operator",
      roleId: operatorRole.id,
    },
  ] as const;

  const seededUsers = new Map<string, { id: string; email: string; roleKey: string }>();
  for (const account of accountDefinitions) {
    const passwordHash = await hashPassword(seedPassword);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        first_name: account.firstName,
        last_name: account.lastName,
        password_hash: passwordHash,
        is_active: true,
      },
      create: {
        email: account.email,
        first_name: account.firstName,
        last_name: account.lastName,
        password_hash: passwordHash,
        is_active: true,
      },
    });

    await prisma.workspaceMembership.upsert({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      },
      update: {
        status: "ACTIVE",
      },
      create: {
        workspace_id: workspace.id,
        user_id: user.id,
        status: "ACTIVE",
      },
    });

    await prisma.userWorkspaceRole.deleteMany({
      where: {
        workspace_id: workspace.id,
        user_id: user.id,
      },
    });

    await prisma.userWorkspaceRole.create({
      data: {
        workspace_id: workspace.id,
        user_id: user.id,
        role_id: account.roleId,
      },
    });

    await prisma.userPreference.upsert({
      where: {
        user_id_workspace_id: {
          user_id: user.id,
          workspace_id: workspace.id,
        },
      },
      update: {},
      create: {
        user_id: user.id,
        workspace_id: workspace.id,
        palette_id: "predefinito",
        language_code: "it",
        rows_projects: 20,
        rows_clients: 20,
      },
    });

    seededUsers.set(account.email, { id: user.id, email: user.email, roleKey: account.roleKey });
  }

  const samuelUser = seededUsers.get("samuel.m@fgautomazioni.it");
  const adminUser = seededUsers.get("admin@birgus.it");
  const guestUser = seededUsers.get("guest@birgus.it");
  if (!samuelUser || !adminUser || !guestUser) {
    throw new Error("Seeded users are incomplete.");
  }

  const desiredOverridesByUserId = new Map<string, Array<{ moduleId: number; mode: "ALLOW" | "DENY"; reason: string }>>();

  const pushOverride = (userId: string, moduleId: number | undefined, mode: "ALLOW" | "DENY", reason: string) => {
    if (!moduleId) {
      return;
    }

    const current = desiredOverridesByUserId.get(userId) ?? [];
    current.push({ moduleId, mode, reason });
    desiredOverridesByUserId.set(userId, current);
  };

  const documentIntelligenceModuleId = documentIntelligenceModule?.id;
  const agentManagementModuleId = agentManagementModule?.id;
  const workflowManagementModuleId = workflowManagementModule?.id;
  const auditCenterModuleId = auditCenterModule?.id;
  const superadminCenterModuleId = superadminCenterModule?.id;
  pushOverride(
    adminUser.id,
    auditCenterModuleId,
    "DENY",
    "Il centro audit resta riservato al superadmin.",
  );
  pushOverride(
    adminUser.id,
    superadminCenterModuleId,
    "DENY",
    "Il centro superadmin resta riservato al superadmin.",
  );

  pushOverride(
    guestUser.id,
    documentIntelligenceModuleId,
    "DENY",
    "L'operatore non vede il modulo di document intelligence.",
  );
  pushOverride(
    guestUser.id,
    agentManagementModuleId,
    "DENY",
    "L'operatore non vede il modulo agenti.",
  );
  pushOverride(
    guestUser.id,
    workflowManagementModuleId,
    "DENY",
    "L'operatore non vede il modulo workflow.",
  );
  pushOverride(
    guestUser.id,
    auditCenterModuleId,
    "DENY",
    "Il centro audit resta riservato al superadmin.",
  );
  pushOverride(
    guestUser.id,
    superadminCenterModuleId,
    "DENY",
    "Il centro superadmin resta riservato al superadmin.",
  );

  const desiredOverrideKeys = new Set<string>();
  for (const [userId, entries] of desiredOverridesByUserId.entries()) {
    for (const entry of entries) {
      desiredOverrideKeys.add(`${userId}:${entry.moduleId}`);
      await prisma.userModuleOverride.upsert({
        where: {
          workspace_id_user_id_module_id: {
            workspace_id: workspace.id,
            user_id: userId,
            module_id: entry.moduleId,
          },
        },
        update: {
          mode: entry.mode,
          reason: entry.reason,
          configured_by_user_id: samuelUser.id,
          configured_at: new Date(),
        },
        create: {
          workspace_id: workspace.id,
          user_id: userId,
          module_id: entry.moduleId,
          mode: entry.mode,
          reason: entry.reason,
          configured_by_user_id: samuelUser.id,
        },
      });
    }
  }

  const existingOverrides = await prisma.userModuleOverride.findMany({
    where: {
      workspace_id: workspace.id,
      user_id: {
        in: [samuelUser.id, adminUser.id, guestUser.id],
      },
    },
    select: {
      user_id: true,
      module_id: true,
    },
  });

  const staleOverrideConditions = existingOverrides
    .filter((item) => !desiredOverrideKeys.has(`${item.user_id}:${item.module_id}`))
    .map((item) => ({
      workspace_id: workspace.id,
      user_id: item.user_id,
      module_id: item.module_id,
    }));

  if (staleOverrideConditions.length > 0) {
    await prisma.userModuleOverride.deleteMany({
      where: {
        OR: staleOverrideConditions,
      },
    });
  }

  const moduleAgentByRef = new Map<string, { id: string; moduleId: number }>();
  for (const prompt of DEFAULT_MODULE_AGENT_PROMPTS) {
    const module = moduleByKey.get(prompt.moduleKey);
    if (!module) {
      continue;
    }

    const agent = await prisma.moduleAgent.upsert({
      where: {
        workspace_id_module_id_key: {
          workspace_id: workspace.id,
          module_id: module.id,
          key: prompt.agentKey,
        },
      },
      update: {
        name: prompt.name,
        label: prompt.label,
        original_prompt: prompt.originalPrompt,
        is_enabled: true,
        updated_by_user_id: adminUser.id,
        deleted_at: null,
      },
      create: {
        workspace_id: workspace.id,
        module_id: module.id,
        key: prompt.agentKey,
        name: prompt.name,
        label: prompt.label,
        original_prompt: prompt.originalPrompt,
        active_prompt: prompt.originalPrompt,
        is_enabled: true,
        created_by_user_id: adminUser.id,
        updated_by_user_id: adminUser.id,
      },
      select: {
        id: true,
        module_id: true,
      },
    });

    moduleAgentByRef.set(`${prompt.moduleKey}:${prompt.agentKey}`, {
      id: agent.id,
      moduleId: agent.module_id,
    });
  }

  const moduleToolDefinitions = [
    {
      moduleKey: "document_intelligence",
      toolKey: "ocr_engine_extract_text",
      name: "ocr_engine_extract_text",
      label: "OCR engine PDF",
      description: "Estrae testo da un PDF tramite il modulo Python OCR condiviso.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "ocr_engine.extract_text_from_pdf_storage",
      inputSchema: {
        type: "object",
        required: ["storagePath"],
        properties: {
          storagePath: { type: "string" },
          fileName: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
      },
      configuration: {
        module: "ocr_engine",
        operation: "extract_text_from_pdf_storage",
      },
    },
    {
      moduleKey: "document_intelligence",
      toolKey: "knowledge_refresh_document",
      name: "knowledge_refresh_document",
      label: "Indicizza documento",
      description: "Aggiorna il knowledge layer e gli embedding di un documento archiviato.",
      runtimeKind: "BACKEND" as const,
      handlerKey: "document_intelligence.refresh_document_knowledge",
      inputSchema: {
        type: "object",
        required: ["documentId"],
        properties: {
          documentId: { type: "string", format: "uuid" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          knowledgeDocumentId: { type: "string", format: "uuid" },
          chunksCreated: { type: "integer" },
        },
      },
      configuration: {
        endpoint: "/api/knowledge/documents/:documentId/refresh",
      },
    },
    {
      moduleKey: "document_intelligence",
      toolKey: "semantic_knowledge_search",
      name: "semantic_knowledge_search",
      label: "Ricerca semantica knowledge",
      description: "Esegue semantic search sui knowledge chunks del workspace.",
      runtimeKind: "BACKEND" as const,
      handlerKey: "document_intelligence.search_workspace_knowledge",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          limit: { type: "integer" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          results: { type: "array" },
        },
      },
      configuration: {
        endpoint: "/api/knowledge/search",
      },
    },
    {
      moduleKey: "document_intelligence",
      toolKey: "document_set_ai_analysis",
      name: "document_set_ai_analysis",
      label: "Analizza documenti",
      description: "Indicizza se necessario e chiede all'AI di riassumere o analizzare piu documenti archiviati.",
      runtimeKind: "BACKEND" as const,
      handlerKey: "document_intelligence.analyze_document_set",
      inputSchema: {
        type: "object",
        required: ["documentIds"],
        properties: {
          documentIds: {
            type: "array",
            items: { type: "string", format: "uuid" },
          },
          prompt: { type: "string" },
          use_deep_reasoning: { type: "boolean" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          documents: { type: "array" },
          reasoning_structure: { type: "object" },
        },
      },
      configuration: {
        endpoint: "/api/knowledge/document-set/analyze",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "langchain_chat",
      name: "langchain_chat",
      label: "AI Chat",
      description: "Esegue una richiesta chat generica tramite orchestratore Python LangChain.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "langchain_orchestrator.chat",
      inputSchema: {
        type: "object",
        required: ["input_text"],
        properties: {
          input_text: { type: "string" },
          instructions: { type: "string" },
          max_tokens: { type: "integer" },
          temperature: { type: "number" },
          use_deep_reasoning: { type: "boolean" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          model: { type: "string" },
          reasoning_structure: { type: "object" },
        },
      },
      configuration: {
        module: "langchain_orchestrator",
        action: "chat",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "langchain_structure_text",
      name: "langchain_structure_text",
      label: "Struttura testo",
      description: "Estrae dati strutturati JSON da testo/OCR tramite orchestratore Python LangChain.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "langchain_orchestrator.structure_text",
      inputSchema: {
        type: "object",
        required: ["extracted_text", "instructions"],
        properties: {
          extracted_text: { type: "string" },
          instructions: { type: "string" },
          json_schema: { type: "object" },
          max_tokens: { type: "integer" },
          temperature: { type: "number" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          structured_data: { type: "object" },
          raw_output: { type: "string" },
          model: { type: "string" },
        },
      },
      configuration: {
        module: "langchain_orchestrator",
        action: "structure_text",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "langchain_compose_email",
      name: "langchain_compose_email",
      label: "Componi email",
      description: "Compone oggetto e corpo email senza invio, usando il contesto del workflow.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "langchain_orchestrator.compose_email",
      inputSchema: {
        type: "object",
        required: ["context"],
        properties: {
          context: { type: "string" },
          client_name: { type: "string" },
          project_name: { type: "string" },
          tone: { type: "string" },
          extra_instructions: { type: "string" },
          max_tokens: { type: "integer" },
          temperature: { type: "number" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          text: { type: "string" },
          model: { type: "string" },
        },
      },
      configuration: {
        module: "langchain_orchestrator",
        action: "compose_email",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "langchain_pipeline_execute",
      name: "langchain_pipeline_execute",
      label: "LangChain pipeline",
      description: "Esegue una mini-pipeline LangChain definita in configurazione nodo.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "langchain_orchestrator.pipeline_execute",
      inputSchema: {
        type: "object",
        required: ["steps"],
        properties: {
          steps: { type: "array" },
          continue_on_error: { type: "boolean" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          completed: { type: "boolean" },
          results: { type: "array" },
        },
      },
      configuration: {
        module: "langchain_orchestrator",
        action: "pipeline_execute",
      },
    },
    {
      moduleKey: "project_management",
      toolKey: "quotation_docx_builder",
      name: "quotation_docx_builder",
      label: "Generatore DOCX preventivo",
      description: "Genera il file Word finale a partire dai dati strutturati del preventivo.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "docx_engine.build_quotation_docx",
      inputSchema: {
        type: "object",
        required: ["structured_data"],
        properties: {
          structured_data: { type: "object" },
          file_name: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          file_name: { type: "string" },
          size_bytes: { type: "integer" },
          content_type: { type: "string" },
          docx_base64: { type: "string" },
        },
      },
      configuration: {
        module: "docx_engine",
        action: "build_quotation_docx",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "generic_document_generator",
      name: "generic_document_generator",
      label: "Generatore documento generico",
      description: "Genera un documento DOCX/PDF da testo o blocchi strutturati, riusando il contenuto prodotto dai nodi precedenti.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "docx_engine.generate_document",
      inputSchema: {
        type: "object",
        required: ["content"],
        properties: {
          content: {
            oneOf: [
              { type: "string" },
              { type: "array" },
              { type: "object" },
            ],
          },
          title: { type: "string" },
          format: { type: "string", enum: ["docx", "pdf"] },
          file_name: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          file_name: { type: "string" },
          content_type: { type: "string" },
          size_bytes: { type: "integer" },
          document_base64: { type: "string" },
        },
      },
      configuration: {
        module: "docx_engine",
        action: "generate_document",
        format: "docx",
      },
    },
    {
      moduleKey: "project_management",
      toolKey: "quotation_mail_delivery",
      name: "quotation_mail_delivery",
      label: "Invio mail preventivo",
      description: "Invia il preventivo generato tramite tool Python SMTP con allegato DOCX.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "mail_engine.send_quotation_email",
      inputSchema: {
        type: "object",
        required: ["to", "version_label", "file_name", "docx_base64"],
        properties: {
          to: { type: "string", format: "email" },
          client_name: { type: "string" },
          project_name: { type: "string" },
          version_label: { type: "string" },
          file_name: { type: "string" },
          docx_base64: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          to: { type: "string" },
          version_label: { type: "string" },
          file_name: { type: "string" },
          size_bytes: { type: "integer" },
          transport_result: {},
        },
      },
      configuration: {
        module: "mail_engine",
        action: "send_quotation_email",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "generic_mail_delivery",
      name: "generic_mail_delivery",
      label: "Invio email generica",
      description: "Invia email testuali con allegati opzionali prodotti dal workflow.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "mail_engine.send_email",
      inputSchema: {
        type: "object",
        required: ["to", "subject", "text"],
        properties: {
          to: { type: "string", format: "email" },
          subject: { type: "string" },
          text: { type: "string" },
          attachments: {
            type: "array",
            items: {
              type: "object",
              required: ["file_name", "content_base64"],
              properties: {
                file_name: { type: "string" },
                content_base64: { type: "string" },
              },
            },
          },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          to: { type: "string" },
          subject: { type: "string" },
          attachments_sent: { type: "array" },
          transport_result: {},
        },
      },
      configuration: {
        module: "mail_engine",
        action: "send_email",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "telegram_message_delivery",
      name: "telegram_message_delivery",
      label: "Invia Telegram",
      description: "Invia un messaggio Telegram usando il testo prodotto dal workflow o la configurazione del nodo.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "messaging_engine.send_telegram",
      inputSchema: {
        type: "object",
        required: ["chat_id", "text"],
        properties: {
          chat_id: { type: "string" },
          text: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          chat_id: { type: "string" },
          provider: { type: "string" },
        },
      },
      configuration: {
        module: "messaging_engine",
        action: "send_telegram",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "whatsapp_message_delivery",
      name: "whatsapp_message_delivery",
      label: "Invia WhatsApp",
      description: "Invia un messaggio WhatsApp Business usando il testo prodotto dal workflow o la configurazione del nodo.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "messaging_engine.send_whatsapp",
      inputSchema: {
        type: "object",
        required: ["to", "text"],
        properties: {
          to: { type: "string" },
          text: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          to: { type: "string" },
          provider: { type: "string" },
        },
      },
      configuration: {
        module: "messaging_engine",
        action: "send_whatsapp",
      },
    },
    {
      moduleKey: "workflow_management",
      toolKey: "scheduled_report_delivery",
      name: "scheduled_report_delivery",
      label: "Pianifica resoconto",
      description: "Pianifica l'invio differito o ricorrente di Email, Telegram o WhatsApp collegati al nodo Schedule.",
      runtimeKind: "BACKEND" as const,
      handlerKey: "workflow_scheduler.schedule_report_delivery",
      inputSchema: {
        type: "object",
        required: ["scheduleWhen"],
        properties: {
          scheduleWhen: { type: "string", format: "date-time" },
          scheduleRepeatValue: { type: "string" },
          scheduleRepeatUnit: { type: "string", enum: ["hours", "days"] },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          scheduled: { type: "array" },
        },
      },
      configuration: {
        module: "workflow_scheduler",
        action: "schedule_report_delivery",
      },
    },
  ];

  const moduleToolByRef = new Map<string, { id: string; moduleId: number }>();
  for (const definition of moduleToolDefinitions) {
    const module = moduleByKey.get(definition.moduleKey);
    if (!module) {
      continue;
    }

    const existingTool = await prisma.moduleTool.findFirst({
      where: {
        workspace_id: workspace.id,
        module_id: module.id,
        key: definition.toolKey,
      },
      select: {
        id: true,
      },
    });

    const tool = existingTool
      ? await prisma.moduleTool.update({
          where: {
            id: existingTool.id,
          },
          data: {
            name: definition.name,
            label: definition.label,
            description: definition.description,
            runtime_kind: definition.runtimeKind,
            handler_key: definition.handlerKey,
            input_schema: definition.inputSchema,
            output_schema: definition.outputSchema,
            configuration: definition.configuration,
            is_enabled: true,
            updated_by_user_id: adminUser.id,
            deleted_at: null,
          },
          select: {
            id: true,
            module_id: true,
          },
        })
      : await prisma.moduleTool.create({
          data: {
            workspace_id: workspace.id,
            module_id: module.id,
            key: definition.toolKey,
            name: definition.name,
            label: definition.label,
            description: definition.description,
            runtime_kind: definition.runtimeKind,
            handler_key: definition.handlerKey,
            input_schema: definition.inputSchema,
            output_schema: definition.outputSchema,
            configuration: definition.configuration,
            is_enabled: true,
            created_by_user_id: adminUser.id,
            updated_by_user_id: adminUser.id,
          },
          select: {
            id: true,
            module_id: true,
          },
        });

    moduleToolByRef.set(`${definition.moduleKey}:${definition.toolKey}`, {
      id: tool.id,
      moduleId: tool.module_id,
    });
  }

  const workflowDefinitions: any[] = [];

  for (const definition of workflowDefinitions) {
    const module = moduleByKey.get(definition.moduleKey);
    if (!module) {
      continue;
    }

    const existingWorkflow = await prisma.moduleWorkflow.findFirst({
      where: {
        workspace_id: workspace.id,
        module_id: module.id,
        key: definition.workflowKey,
      },
      select: {
        id: true,
      },
    });

    const workflow = existingWorkflow
      ? await prisma.moduleWorkflow.update({
          where: {
            id: existingWorkflow.id,
          },
          data: {
            name: definition.name,
            label: definition.label,
            description: definition.description,
            configuration: definition.configuration,
            version_no: 1,
            is_enabled: true,
            is_default: definition.isDefault,
            updated_by_user_id: adminUser.id,
            deleted_at: null,
          },
          select: {
            id: true,
          },
        })
      : await prisma.moduleWorkflow.create({
          data: {
            workspace_id: workspace.id,
            module_id: module.id,
            key: definition.workflowKey,
            name: definition.name,
            label: definition.label,
            description: definition.description,
            configuration: definition.configuration,
            version_no: 1,
            is_enabled: true,
            is_default: definition.isDefault,
            created_by_user_id: adminUser.id,
            updated_by_user_id: adminUser.id,
          },
          select: {
            id: true,
          },
        });

    const workflowNodeByKey = new Map<string, { id: string }>();
    for (const node of definition.nodes) {
      const moduleAgent = "moduleAgentRef" in node && node.moduleAgentRef ? moduleAgentByRef.get(node.moduleAgentRef) : null;
      const moduleTool = "moduleToolRef" in node && node.moduleToolRef ? moduleToolByRef.get(node.moduleToolRef) : null;

      const existingNode = await prisma.moduleWorkflowNode.findFirst({
        where: {
          workflow_id: workflow.id,
          node_key: node.nodeKey,
        },
        select: {
          id: true,
        },
      });

      const savedNode = existingNode
        ? await prisma.moduleWorkflowNode.update({
            where: {
              id: existingNode.id,
            },
            data: {
              node_kind: node.nodeKind,
              label: node.label,
              position_x: node.positionX,
              position_y: node.positionY,
              module_agent_id: moduleAgent?.id ?? null,
              module_tool_id: moduleTool?.id ?? null,
              input_kind: "inputKind" in node ? node.inputKind ?? null : null,
              output_kind: "outputKind" in node ? node.outputKind ?? null : null,
              configuration: node.configuration ?? null,
              is_required: "isRequired" in node ? node.isRequired ?? false : false,
              is_enabled: true,
            },
            select: {
              id: true,
            },
          })
        : await prisma.moduleWorkflowNode.create({
            data: {
              workflow_id: workflow.id,
              workspace_id: workspace.id,
              node_key: node.nodeKey,
              node_kind: node.nodeKind,
              label: node.label,
              position_x: node.positionX,
              position_y: node.positionY,
              module_agent_id: moduleAgent?.id ?? null,
              module_tool_id: moduleTool?.id ?? null,
              input_kind: "inputKind" in node ? node.inputKind ?? null : null,
              output_kind: "outputKind" in node ? node.outputKind ?? null : null,
              configuration: node.configuration ?? null,
              is_required: "isRequired" in node ? node.isRequired ?? false : false,
              is_enabled: true,
            },
            select: {
              id: true,
            },
          });

      workflowNodeByKey.set(node.nodeKey, savedNode);
    }

    await prisma.moduleWorkflowEdge.deleteMany({
      where: {
        workflow_id: workflow.id,
      },
    });

    await prisma.moduleWorkflowEdge.createMany({
      data: definition.edges.map((edge) => {
        const sourceNode = workflowNodeByKey.get(edge.source);
        const targetNode = workflowNodeByKey.get(edge.target);
        if (!sourceNode || !targetNode) {
          throw new Error(`Workflow edge non valido per ${definition.workflowKey}: ${edge.source} -> ${edge.target}`);
        }

        return {
          workspace_id: workspace.id,
          workflow_id: workflow.id,
          source_node_id: sourceNode.id,
          target_node_id: targetNode.id,
          order_no: edge.orderNo,
          is_enabled: true,
        };
      }),
    });
  }

  await seedOperationsDemoData(workspace.id);

  console.log("Seed completed:", {
    organization: organization.code,
    workspace: workspace.code,
    users: accountDefinitions.map((item) => ({
      email: item.email,
      role: item.roleKey,
    })),
    modules: MODULE_KEYS.length,
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

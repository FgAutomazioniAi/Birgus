import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../nest/prisma/prisma.service.js";

const toNumber = (value: { toNumber: () => number } | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "number" ? value : value.toNumber();
};

@Injectable()
export class OperationsInsightService {
  public constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  public async listCustomerMap(workspaceId: string): Promise<Array<Record<string, unknown>>> {
    const addresses = await this.prisma.customerAddress.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        customer: {
          deleted_at: null,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            source_system: true,
            external_id: true,
          },
        },
      },
      orderBy: [{ customer: { name: "asc" } }, { city: "asc" }, { label: "asc" }],
    });

    return addresses.map((address) => ({
      id: address.id,
      customerId: address.customer_id,
      customerName: address.customer.name,
      customerEmail: address.customer.email,
      customerPhone: address.customer.phone,
      label: address.label,
      addressLine1: address.address_line_1,
      addressLine2: address.address_line_2,
      postalCode: address.postal_code,
      city: address.city,
      province: address.province,
      country: address.country,
      latitude: toNumber(address.latitude),
      longitude: toNumber(address.longitude),
      geocodingStatus: address.geocoding_status,
      geocodingProvider: address.geocoding_provider,
      sourceSystem: address.source_system ?? address.customer.source_system,
      externalId: address.external_id,
      customerExternalId: address.customer.external_id,
    }));
  }

  public async listOfferPriority(workspaceId: string): Promise<Array<Record<string, unknown>>> {
    const offers = await this.prisma.commercialOffer.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        work_reference: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        lines: {
          where: { deleted_at: null },
          orderBy: [{ total_amount: "desc" }, { line_number: "asc" }],
          take: 3,
        },
      },
      orderBy: [{ priority_score: "desc" }, { total_amount: "desc" }, { issued_at: "asc" }],
    });

    return offers.map((offer) => ({
      id: offer.id,
      offerCode: offer.offer_code,
      offerNumber: offer.offer_number,
      offerSeries: offer.offer_series,
      customerId: offer.customer_id,
      customerName: offer.customer?.name ?? "",
      workReferenceCode: offer.work_reference?.code ?? "",
      workReferenceName: offer.work_reference?.name ?? "",
      status: offer.status,
      subject: offer.subject,
      modelCode: offer.model_code,
      totalAmount: toNumber(offer.total_amount),
      issuedAt: offer.issued_at,
      competence: offer.competence,
      conversionRate: toNumber(offer.conversion_rate),
      priorityScore: toNumber(offer.priority_score),
      priorityBand: offer.priority_band,
      abcClass: offer.abc_class,
      cumulativeShare: toNumber(offer.cumulative_share),
      sourceSystem: offer.source_system,
      externalId: offer.external_id,
      topLines: offer.lines.map((line) => ({
        id: line.id,
        lineNumber: line.line_number,
        itemCode: line.item_code,
        description: line.description,
        quantity: toNumber(line.quantity),
        totalAmount: toNumber(line.total_amount),
      })),
    }));
  }

  public async listMaintenanceProposals(workspaceId: string): Promise<Record<string, unknown>> {
    const proposals = await this.prisma.maintenanceProposal.findMany({
        where: {
          workspace_id: workspaceId,
          deleted_at: null,
        },
        include: {
          work_reference: {
            select: {
              id: true,
              code: true,
              name: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ urgency: "asc" }, { suggested_at: "asc" }, { updated_at: "desc" }],
      });

    return {
      proposals: proposals.map((proposal) => ({
        id: proposal.id,
        customerName: proposal.work_reference?.customer?.name ?? proposal.customer_name_snapshot ?? "",
        workReferenceId: proposal.work_reference_id,
        workReferenceCode: proposal.work_reference?.code ?? "",
        workReferenceName: proposal.work_reference?.name ?? proposal.work_reference_snapshot ?? "",
        lastServiceAt: proposal.last_service_at,
        suggestedAt: proposal.suggested_at,
        estimatedFrequencyDays: proposal.estimated_frequency_days,
        historicalEventsCount: proposal.historical_events_count,
        historicalWorkMinutes: proposal.historical_work_minutes,
        preferredOperator: proposal.preferred_operator,
        annualPlanHint: proposal.annual_plan_hint,
        urgency: proposal.urgency,
        reason: proposal.reason,
        sourceSystem: proposal.source_system,
        externalId: proposal.external_id,
      })),
    };
  }

  public async listMaintenanceCalendar(workspaceId: string): Promise<Array<Record<string, unknown>>> {
    const planEntries = await this.prisma.maintenancePlanEntry.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
      },
      include: {
        work_reference: {
          select: {
            id: true,
            code: true,
            name: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ planned_start_at: "asc" }, { title: "asc" }],
    });

    return planEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      customerName: entry.work_reference?.customer?.name ?? "",
      workReferenceId: entry.work_reference_id,
      workReferenceCode: entry.work_reference?.code ?? "",
      workReferenceName: entry.work_reference?.name ?? "",
      plannedStartAt: entry.planned_start_at,
      plannedEndAt: entry.planned_end_at,
      status: entry.status,
      assigneeName: entry.assignee_name,
      note: entry.note,
      sourceSystem: entry.source_system,
      externalId: entry.external_id,
    }));
  }
}

import { Buffer } from "node:buffer";

import { AlignmentType, Document, Footer, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

import { QuotationStructuredData } from "../domain/QuotationStructuredData.js";

export class QuotationDocxBuilder {
  public async build(structuredData: QuotationStructuredData): Promise<Buffer> {
    const bodyChildren = [
      this.createLine(this.composePlaceDate(structuredData), { spacingAfter: 120 }),
      this.createOptionalLine(this.prefixIfPresent("Attn. ", structuredData.Attn)),
      this.createOptionalLine(structuredData.Company),
      this.createOptionalLine(structuredData.Address1),
      this.createOptionalLine(structuredData.Address2),
      this.createSpacer(),
      this.createOptionalLine(this.prefixIfPresent("RE: ", structuredData.Reference), true),
      this.createSpacer(),
      this.createOptionalLine(structuredData.Greeting),
      this.createSpacer(),
      this.createSpecificationTable(structuredData),
      this.createSpacer(),
      this.createOptionalLine(structuredData.ClosingHeaderAttn),
      this.createOptionalLine(this.prefixIfPresent("RE: ", structuredData.ClosingReference), true),
      this.createSpacer(),
      this.createOptionalParagraph(structuredData.ClosingParagraph1),
      this.createOptionalParagraph(structuredData.ClosingParagraph2),
      this.createSpacer(),
      this.createOptionalLine(structuredData.Signoff),
      this.createOptionalLine(structuredData.Signature),
    ].filter((child): child is Paragraph | Table => child !== null);

    const document = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1134,
                right: 1134,
                bottom: 1134,
                left: 1134,
              },
            },
          },
          footers: {
            default: this.createFooter(),
          },
          children: bodyChildren,
        },
      ],
    });

    return Packer.toBuffer(document);
  }

  private createSpecificationTable(data: QuotationStructuredData): Table {
    const rows = [
      this.createDataRow("Title:", data.Title),
      this.createDataRow("Printing / Press:", data["Printing/Press"]),
      this.createDataRow("Imposition:", data.Imposition),
      this.createDataRow("Trim size:", data["Trim size"]),
      this.createDataRow("Extent:", data.Extent),
      this.createDataRow("Text:", data.Text),
      this.createDataRow("1st form:", data["1st form"]),
      this.createDataRow("Endpapers:", data.Endpapers),
      this.createDataRow("Casecover:", data.Casecover),
      this.createDataRow("Dust jacket:", data["Dust jacket"]),
      this.createDataRow("Binding:", data.Binding),
      this.createDataRow("Packing:", data.Packing),
      this.createDataRow("Cartons:", data.Cartons),
      this.createDataRow("Transport:", data.Transport),
      this.createDataRow("Prices:", data.Prices),
      this.createDataRow("Extra costs:", data["Extra costs"]),
    ];

    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows,
    });
  }

  private createDataRow(label: string, value: string | null): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 24, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  font: "Arial",
                  size: 18,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 76, type: WidthType.PERCENTAGE },
          children: this.toParagraphs(value),
        }),
      ],
    });
  }

  private toParagraphs(value: string | null): Paragraph[] {
    const lines = this.normalizeMultiline(value);
    if (lines.length === 0) {
      return [this.createLine("")];
    }

    return lines.map((line) => this.createLine(line));
  }

  private normalizeMultiline(value: string | null): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line, index, all) => line.length > 0 || (index === 0 && all.length === 1));
  }

  private createOptionalParagraph(value: string | null): Paragraph | null {
    if (!value?.trim()) {
      return null;
    }

    return new Paragraph({
      spacing: { after: 120 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: value.trim(),
          font: "Arial",
          size: 20,
        }),
      ],
    });
  }

  private createOptionalLine(value: string | null, bold = false): Paragraph | null {
    if (!value?.trim()) {
      return null;
    }

    return this.createLine(value.trim(), { bold });
  }

  private createLine(text: string, options?: { bold?: boolean; spacingAfter?: number }): Paragraph {
    return new Paragraph({
      spacing: {
        after: options?.spacingAfter ?? 30,
      },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text,
          bold: options?.bold ?? false,
          font: "Arial",
          size: 20,
        }),
      ],
    });
  }

  private createSpacer(): Paragraph {
    return new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: "", font: "Arial", size: 20 })],
    });
  }

  private composePlaceDate(data: QuotationStructuredData): string {
    const place = data.Place?.trim() || "San Giovanni Lupatoto";
    const date = data.Date?.trim();
    return date ? `${place}, ${date}` : place;
  }

  private prefixIfPresent(prefix: string, value: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? `${prefix}${normalized}` : null;
  }

  private createFooter(): Footer {
    return new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 0 },
          children: [
            new TextRun({
              text: "Birgus srl | Headquarter | Via Giuseppe Garibaldi, 5/41 | 37057 San Giovanni Lupatoto | Verona | Italia",
              font: "Arial",
              size: 12,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
          children: [
            new TextRun({
              text: "Tel. +39 045 8781396 | info@birgus.com | www.birgus.com",
              font: "Arial",
              size: 12,
            }),
          ],
        }),
      ],
    });
  }
}

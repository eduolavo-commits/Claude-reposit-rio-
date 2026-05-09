import {
  PDFDocument,
  StandardFonts,
  rgb,
  PageSizes,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { formatDateBR, maskCpf } from "@/lib/utils";
import { readFileSync } from "fs";
import path from "path";

interface CertificateInput {
  type: "certificate" | "recommendation";
  fullName: string;
  cpf: string;
  courseTitle: string;
  syllabusMarkdown: string | null;
  issuedAt: string | Date;
  signatureName: string;
  signatureRole: string;
  verificationUrl: string;
}

/**
 * Generates a 2-page A4 landscape PDF: front (certificate template + dynamic
 * fields), back (course syllabus).
 *
 * The front uses the design from the model image with branding strokes — at
 * runtime, you can replace the hand-drawn shapes with an embedded PNG by
 * dropping a file at lib/certificate/template-front.png; the loader below
 * picks it up automatically.
 */
export async function buildCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const front = pdf.addPage(PageSizes.A4.slice().reverse() as [number, number]); // landscape
  await drawFront(pdf, front, helv, helvBold, helvItalic, input);

  const back = pdf.addPage(PageSizes.A4.slice().reverse() as [number, number]);
  drawBack(back, helv, helvBold, input);

  return await pdf.save();
}

async function drawFront(
  pdf: PDFDocument,
  page: PDFPage,
  helv: PDFFont,
  helvBold: PDFFont,
  helvItalic: PDFFont,
  input: CertificateInput,
) {
  const { width, height } = page.getSize();
  const navy = rgb(31 / 255, 58 / 255, 138 / 255);
  const gold = rgb(212 / 255, 162 / 255, 58 / 255);
  const dark = rgb(0.08, 0.08, 0.1);

  // Try to embed PNG template if present
  try {
    const tplPath = path.join(process.cwd(), "lib", "certificate", "template-front.png");
    const bytes = readFileSync(tplPath);
    const img = await pdf.embedPng(bytes);
    page.drawImage(img, { x: 0, y: 0, width, height });
  } catch {
    // Fallback: draw decorative strokes inspired by the model
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    // Top-right curves
    page.drawRectangle({
      x: width - 220,
      y: height - 60,
      width: 220,
      height: 60,
      color: navy,
    });
    page.drawRectangle({
      x: width - 260,
      y: height - 90,
      width: 260,
      height: 30,
      color: gold,
    });
    // Bottom-left curves
    page.drawRectangle({ x: 0, y: 0, width: 260, height: 30, color: gold });
    page.drawRectangle({ x: 0, y: 30, width: 220, height: 60, color: navy });
    // Left ribbon
    page.drawRectangle({ x: 60, y: height - 200, width: 30, height: 200, color: rgb(0.85, 0.78, 0.6) });
  }

  const headerType = input.type === "recommendation" ? "CARTA DE RECOMENDAÇÃO" : "CERTIFICADO";
  const subType = input.type === "recommendation" ? "" : "DIPLOMA";

  // Header
  page.drawText(headerType, {
    x: width / 2 - helvBold.widthOfTextAtSize(headerType, 44) / 2,
    y: height - 130,
    size: 44,
    font: helvBold,
    color: dark,
  });
  if (subType) {
    page.drawText(subType, {
      x: width / 2 - helv.widthOfTextAtSize(subType, 18) / 2,
      y: height - 158,
      size: 18,
      font: helv,
      color: dark,
    });
  }

  // Course title (gold)
  const courseUpper = `#${input.courseTitle.toUpperCase()}`;
  page.drawText(courseUpper, {
    x: width / 2 - helv.widthOfTextAtSize(courseUpper, 14) / 2,
    y: height - 195,
    size: 14,
    font: helvBold,
    color: gold,
  });

  // Student name
  const studentName = input.fullName.toUpperCase();
  page.drawText(studentName, {
    x: width / 2 - helvBold.widthOfTextAtSize(studentName, 28) / 2,
    y: height - 260,
    size: 28,
    font: helvBold,
    color: dark,
  });

  // CPF
  const cpfText = maskCpf(input.cpf);
  page.drawText(cpfText, {
    x: width / 2 - helv.widthOfTextAtSize(cpfText, 14) / 2,
    y: height - 290,
    size: 14,
    font: helv,
    color: dark,
  });

  // Body
  const body1 = "CONFERIMOS O SEGUINTE CERTIFICADO PELA PARTICIPAÇÃO";
  const body2 = `NO CURSO ${input.courseTitle.toUpperCase()}`;
  page.drawText(body1, {
    x: width / 2 - helv.widthOfTextAtSize(body1, 12) / 2,
    y: height - 360,
    size: 12,
    font: helv,
    color: dark,
  });
  page.drawText(body2, {
    x: width / 2 - helv.widthOfTextAtSize(body2, 12) / 2,
    y: height - 378,
    size: 12,
    font: helv,
    color: dark,
  });

  // Signatures
  const sigY = 110;
  // Left signature (Veterinária - exemplo do modelo)
  page.drawLine({
    start: { x: 80, y: sigY },
    end: { x: 320, y: sigY },
    thickness: 1,
    color: dark,
  });
  page.drawText("DRA IRIS MELO CUNHA", {
    x: 110,
    y: sigY - 15,
    size: 11,
    font: helvBold,
    color: dark,
  });
  page.drawText("Médica Veterinária", {
    x: 145,
    y: sigY - 30,
    size: 9,
    font: helvItalic,
    color: gold,
  });

  // Right signature (Director)
  page.drawLine({
    start: { x: width - 320, y: sigY },
    end: { x: width - 80, y: sigY },
    thickness: 1,
    color: dark,
  });
  page.drawText(input.signatureName.toUpperCase(), {
    x: width - 270,
    y: sigY - 15,
    size: 11,
    font: helvBold,
    color: dark,
  });
  page.drawText(input.signatureRole, {
    x: width - 250,
    y: sigY - 30,
    size: 9,
    font: helvItalic,
    color: dark,
  });
  page.drawText(`Data de emissão: ${formatDateBR(input.issuedAt)}`, {
    x: width - 280,
    y: sigY - 50,
    size: 10,
    font: helv,
    color: gold,
  });

  // Footer verification URL
  page.drawText(`Verifique a autenticidade em: ${input.verificationUrl}`, {
    x: 30,
    y: 20,
    size: 7,
    font: helv,
    color: rgb(0.4, 0.4, 0.4),
  });
}

function drawBack(
  page: PDFPage,
  helv: PDFFont,
  helvBold: PDFFont,
  input: CertificateInput,
) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  const margin = 60;
  let y = height - margin;
  page.drawText("CONTEÚDO PROGRAMÁTICO", {
    x: margin,
    y,
    size: 18,
    font: helvBold,
    color: rgb(0.08, 0.08, 0.1),
  });
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(212 / 255, 162 / 255, 58 / 255),
  });
  y -= 26;
  page.drawText(`Curso: ${input.courseTitle}`, {
    x: margin,
    y,
    size: 12,
    font: helvBold,
    color: rgb(0.08, 0.08, 0.1),
  });
  y -= 24;

  const lines = (input.syllabusMarkdown ?? "Conteúdo programático não informado.").split("\n");
  const fontSize = 11;
  const lineHeight = 16;
  const maxWidth = width - margin * 2;

  for (const raw of lines) {
    if (y < 80) break;
    const isBullet = /^\s*[-*]\s+/.test(raw);
    const isHeading = /^\s*#{1,6}\s+/.test(raw);
    const text = raw.replace(/^\s*([-*]|#{1,6})\s+/, "").trim();
    const f = isHeading ? helvBold : helv;
    const prefix = isBullet ? "• " : "";

    const wrapped = wrap(`${prefix}${text}`, f, fontSize, maxWidth);
    for (const w of wrapped) {
      page.drawText(w, { x: margin, y, size: fontSize, font: f });
      y -= lineHeight;
      if (y < 80) break;
    }
    if (isHeading) y -= 4;
  }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (line) out.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}

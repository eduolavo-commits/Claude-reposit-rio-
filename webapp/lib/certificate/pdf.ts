import {
  PDFDocument,
  StandardFonts,
  rgb,
  PageSizes,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { formatDateBR, maskCpf } from "@/lib/utils";
import { readFileSync } from "fs";
import path from "path";

// Constantes da organização (usadas no certificado e na carta).
const ORG_NAME = "AGS.CLICK Treinamentos";
const ORG_LEGAL = "Agências Click!";
const ORG_CNPJ = "28.328.907/0001-01";
const ORG_ADDRESS = "Rua Armando de Amorim, 140 — Cordeiros, Itajaí/SC";
const ORG_CITY = "Itajaí/SC";

const NAVY = rgb(31 / 255, 58 / 255, 138 / 255);
const GOLD = rgb(212 / 255, 162 / 255, 58 / 255);
const DARK = rgb(0.08, 0.08, 0.1);
const RIBBON = rgb(0.85, 0.78, 0.6);

interface CertificateInput {
  type: "certificate" | "recommendation";
  fullName: string;
  cpf: string;
  courseTitle: string;
  /** Cargo/função usado na frase final da carta. Se nulo, usa courseTitle. */
  recommendationRole: string | null;
  syllabusMarkdown: string | null;
  issuedAt: string | Date;
  signatureName: string;
  signatureRole: string;
  verificationUrl: string;
  /** URL pública do PNG/JPG enviado pelo admin para a frente do certificado. */
  certificateTemplateUrl?: string | null;
  /** URL pública do PNG/JPG enviado pelo admin para a carta de recomendação. */
  recommendationTemplateUrl?: string | null;
}

async function fetchImage(pdf: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (url.toLowerCase().endsWith(".jpg") || url.toLowerCase().endsWith(".jpeg")) {
      return await pdf.embedJpg(buf);
    }
    return await pdf.embedPng(buf);
  } catch {
    return null;
  }
}

export async function buildCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  if (input.type === "recommendation") {
    const portrait = pdf.addPage(PageSizes.A4); // [595.28, 841.89]
    await drawRecommendationLetter(pdf, portrait, helv, helvBold, helvItalic, input);
  } else {
    const landscape = pdf.addPage(PageSizes.A4.slice().reverse() as [number, number]);
    await drawCertificateFront(pdf, landscape, helv, helvBold, helvItalic, times, timesBold, input);
    const back = pdf.addPage(PageSizes.A4.slice().reverse() as [number, number]);
    drawCertificateBack(back, helv, helvBold, input);
  }

  return await pdf.save();
}

// ============================================================================
// CERTIFICADO — frente (paisagem)
// ============================================================================

async function drawCertificateFront(
  pdf: PDFDocument,
  page: PDFPage,
  helv: PDFFont,
  helvBold: PDFFont,
  helvItalic: PDFFont,
  times: PDFFont,
  timesBold: PDFFont,
  input: CertificateInput,
) {
  const { width, height } = page.getSize();

  // Prioridade do template:
  //   1) URL enviada pelo admin (por curso) — courses.certificate_template_url
  //   2) PNG global em lib/certificate/template-front.png (fallback antigo)
  //   3) Desenho próprio (cantos navy+ouro)
  let usedTemplate = false;
  if (input.certificateTemplateUrl) {
    const img = await fetchImage(pdf, input.certificateTemplateUrl);
    if (img) {
      page.drawImage(img, { x: 0, y: 0, width, height });
      usedTemplate = true;
    }
  }
  if (!usedTemplate) {
    try {
      const tplPath = path.join(process.cwd(), "lib", "certificate", "template-front.png");
      const bytes = readFileSync(tplPath);
      const img = await pdf.embedPng(bytes);
      page.drawImage(img, { x: 0, y: 0, width, height });
      usedTemplate = true;
    } catch {
      drawCertificateBackground(page, width, height);
    }
  }

  if (!usedTemplate) {
    // Cabeçalho impresso só quando não temos o template
    page.drawText("CERTIFICADO", {
      x: width / 2 - timesBold.widthOfTextAtSize("CERTIFICADO", 56) / 2,
      y: height - 130,
      size: 56,
      font: timesBold,
      color: DARK,
    });
    const sub = "D I P L O M A";
    page.drawText(sub, {
      x: width / 2 - times.widthOfTextAtSize(sub, 18) / 2,
      y: height - 162,
      size: 18,
      font: times,
      color: DARK,
    });
  }

  // Variáveis dinâmicas
  const courseUpper = input.courseTitle.toUpperCase();
  const courseSize = fitSize(helvBold, courseUpper, 14, width - 220);
  page.drawText(courseUpper, {
    x: width / 2 - helvBold.widthOfTextAtSize(courseUpper, courseSize) / 2,
    y: height - 210,
    size: courseSize,
    font: helvBold,
    color: GOLD,
  });

  const studentName = input.fullName.toUpperCase();
  const nameSize = fitSize(helvBold, studentName, 30, width - 200);
  page.drawText(studentName, {
    x: width / 2 - helvBold.widthOfTextAtSize(studentName, nameSize) / 2,
    y: height - 290,
    size: nameSize,
    font: helvBold,
    color: DARK,
  });

  const cpfText = `CPF: ${maskCpf(input.cpf)}`;
  page.drawText(cpfText, {
    x: width / 2 - helv.widthOfTextAtSize(cpfText, 14) / 2,
    y: height - 320,
    size: 14,
    font: helv,
    color: DARK,
  });

  const body1 = "Conferimos o seguinte certificado pela participação";
  const body2 = `no curso ${input.courseTitle}`;
  page.drawText(body1, {
    x: width / 2 - helv.widthOfTextAtSize(body1, 12) / 2,
    y: height - 380,
    size: 12,
    font: helv,
    color: DARK,
  });
  page.drawText(body2, {
    x: width / 2 - helv.widthOfTextAtSize(body2, 12) / 2,
    y: height - 398,
    size: 12,
    font: helv,
    color: DARK,
  });

  // Assinaturas
  const sigY = 110;
  page.drawLine({
    start: { x: 80, y: sigY },
    end: { x: 320, y: sigY },
    thickness: 1,
    color: DARK,
  });
  page.drawText("DRA IRIS MELO CUNHA", {
    x: 105,
    y: sigY - 15,
    size: 11,
    font: helvBold,
    color: DARK,
  });
  page.drawText("Médica Veterinária", {
    x: 145,
    y: sigY - 30,
    size: 9,
    font: helvItalic,
    color: GOLD,
  });

  page.drawLine({
    start: { x: width - 320, y: sigY },
    end: { x: width - 80, y: sigY },
    thickness: 1,
    color: DARK,
  });
  page.drawText(input.signatureName.toUpperCase(), {
    x: width - 280,
    y: sigY - 15,
    size: 11,
    font: helvBold,
    color: DARK,
  });
  page.drawText(input.signatureRole, {
    x: width - 250,
    y: sigY - 30,
    size: 9,
    font: helvItalic,
    color: DARK,
  });
  page.drawText(formatDateBR(input.issuedAt), {
    x: width - 220,
    y: sigY - 50,
    size: 11,
    font: helv,
    color: GOLD,
  });

  // CNPJ vertical à esquerda (visível em ambos os modos)
  const cnpjLabel = `CNPJ: ${ORG_CNPJ.replace(/[^0-9]/g, "")}`;
  page.drawText(cnpjLabel, {
    x: 22,
    y: height / 2 - helv.widthOfTextAtSize(cnpjLabel, 8) / 2,
    size: 8,
    font: helv,
    color: rgb(0.35, 0.35, 0.35),
    rotate: { type: "degrees", angle: 90 },
  });

  // Rodapé com URL de verificação
  page.drawText(`Verifique a autenticidade em: ${input.verificationUrl}`, {
    x: 30,
    y: 18,
    size: 7,
    font: helv,
    color: rgb(0.4, 0.4, 0.4),
  });
}

function drawCertificateBackground(page: PDFPage, width: number, height: number) {
  // Fundo branco
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  // Cantos decorativos navy + dourado (canto superior direito)
  page.drawRectangle({ x: width - 280, y: height - 70, width: 280, height: 70, color: NAVY });
  page.drawRectangle({ x: width - 320, y: height - 100, width: 320, height: 30, color: GOLD });

  // Cantos decorativos navy + dourado (canto inferior esquerdo)
  page.drawRectangle({ x: 0, y: 0, width: 280, height: 30, color: GOLD });
  page.drawRectangle({ x: 0, y: 30, width: 280, height: 70, color: NAVY });

  // Faixa dourada vertical à esquerda (estilo fita do template)
  page.drawRectangle({ x: 60, y: height - 220, width: 30, height: 220, color: RIBBON });

  // Selo circular indicativo (placeholder — substituído quando o PNG é provido)
  page.drawCircle({ x: 100, y: height - 110, size: 38, color: NAVY });
  page.drawCircle({ x: 100, y: height - 110, size: 30, color: rgb(1, 1, 1) });
  page.drawCircle({ x: 100, y: height - 110, size: 26, color: NAVY });
}

function fitSize(font: PDFFont, text: string, base: number, maxWidth: number): number {
  let size = base;
  while (size > 8 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

// ============================================================================
// CERTIFICADO — verso (conteúdo programático)
// ============================================================================

function drawCertificateBack(
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
    color: DARK,
  });
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: GOLD,
  });
  y -= 26;
  page.drawText(`Curso: ${input.courseTitle}`, {
    x: margin,
    y,
    size: 12,
    font: helvBold,
    color: DARK,
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

  // Rodapé
  page.drawText(`${ORG_LEGAL} — CNPJ ${ORG_CNPJ}`, {
    x: margin,
    y: 30,
    size: 8,
    font: helv,
    color: rgb(0.4, 0.4, 0.4),
  });
}

// ============================================================================
// CARTA DE RECOMENDAÇÃO — retrato
// ============================================================================

async function drawRecommendationLetter(
  pdf: PDFDocument,
  page: PDFPage,
  helv: PDFFont,
  helvBold: PDFFont,
  helvItalic: PDFFont,
  input: CertificateInput,
) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  // Se há template enviado pelo admin, desenha por baixo e sobrepõe só os textos
  // dinâmicos. Caso contrário, mantém faixas decorativas + cabeçalho próprio.
  let usedTemplate = false;
  if (input.recommendationTemplateUrl) {
    const img = await fetchImage(pdf, input.recommendationTemplateUrl);
    if (img) {
      page.drawImage(img, { x: 0, y: 0, width, height });
      usedTemplate = true;
    }
  }

  if (!usedTemplate) {
    // Faixas decorativas (espelhando o estilo do certificado)
    page.drawRectangle({ x: 0, y: height - 70, width: width, height: 8, color: NAVY });
    page.drawRectangle({ x: 0, y: height - 80, width: width, height: 4, color: GOLD });
    page.drawRectangle({ x: 0, y: 60, width: width, height: 4, color: GOLD });
    page.drawRectangle({ x: 0, y: 50, width: width, height: 8, color: NAVY });
  }

  const margin = 60;
  let y = height - 110;

  if (!usedTemplate) {
    // Cabeçalho da organização (só quando não usamos o template)
    page.drawText(ORG_LEGAL, {
      x: margin,
      y,
      size: 18,
      font: helvBold,
      color: NAVY,
    });
    y -= 16;
    page.drawText("Carta de Recomendação Oficial", {
      x: margin,
      y,
      size: 12,
      font: helvItalic,
      color: GOLD,
    });
    y -= 14;
    page.drawText(`CNPJ ${ORG_CNPJ} — ${ORG_ADDRESS}`, {
      x: margin,
      y,
      size: 9,
      font: helv,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 10;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.6,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 36;
    page.drawText("A quem possa interessar:", {
      x: margin,
      y,
      size: 12,
      font: helvBold,
      color: DARK,
    });
    y -= 30;
  } else {
    // Quando há template, abaixamos o ponto de partida para o texto cair na
    // área central do PDF (fica abaixo do cabeçalho da arte).
    y = height - 230;
  }

  // Corpo da carta
  const role = (input.recommendationRole?.trim() || input.courseTitle).trim();
  const paragraphs = [
    `A ${ORG_NAME}, inscrita no CNPJ sob o nº ${ORG_CNPJ}, com sede na ${ORG_ADDRESS}, vem por meio desta recomendar o(a) Sr.(a) ${input.fullName}, portador(a) do CPF ${maskCpf(input.cpf)}, que concluiu com êxito o curso "${input.courseTitle}" oferecido por nossa instituição.`,
    `Durante o período de formação, demonstrou excelente frequência, dedicação e comprometimento, mostrando-se uma pessoa idônea, cumpridora dos seus deveres e com perfil profissional adequado para atuação na área.`,
    `Diante disso, recomendamos ${input.fullName} como uma ótima contratação para estágio ou função de ${role}.`,
    `Permanecemos à disposição para quaisquer esclarecimentos adicionais que se façam necessários.`,
  ];

  const fontSize = 11.5;
  const lineHeight = 17;
  const maxWidth = width - margin * 2;

  for (const p of paragraphs) {
    const lines = wrap(p, helv, fontSize, maxWidth);
    for (const ln of lines) {
      page.drawText(ln, { x: margin, y, size: fontSize, font: helv, color: DARK });
      y -= lineHeight;
    }
    y -= 8; // espaço entre parágrafos
  }

  // Local + data
  y -= 10;
  const locDate = `${ORG_CITY}, ${formatDateBR(input.issuedAt)}.`;
  page.drawText(locDate, {
    x: width - margin - helv.widthOfTextAtSize(locDate, fontSize),
    y,
    size: fontSize,
    font: helv,
    color: DARK,
  });

  // Assinatura
  const sigY = 160;
  page.drawLine({
    start: { x: width / 2 - 130, y: sigY },
    end: { x: width / 2 + 130, y: sigY },
    thickness: 1,
    color: DARK,
  });
  page.drawText(input.signatureName, {
    x: width / 2 - helvBold.widthOfTextAtSize(input.signatureName, 12) / 2,
    y: sigY - 16,
    size: 12,
    font: helvBold,
    color: DARK,
  });
  page.drawText(`${input.signatureRole} — CEO / Founder`, {
    x: width / 2 - helvItalic.widthOfTextAtSize(`${input.signatureRole} — CEO / Founder`, 10) / 2,
    y: sigY - 30,
    size: 10,
    font: helvItalic,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Rodapé com link de verificação
  page.drawText(`Verifique a autenticidade desta carta em: ${input.verificationUrl}`, {
    x: margin,
    y: 30,
    size: 7.5,
    font: helv,
    color: rgb(0.4, 0.4, 0.4),
  });
}

// ============================================================================
// utils
// ============================================================================

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

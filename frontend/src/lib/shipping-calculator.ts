export type BloccoType = "cucito" | "fresato";
export type CopertinaType = "quadro" | "tondo" | "olandese";
export type SopracopertaType = "normale" | "antistrappo";
export type BancaleType = "100x120" | "80x120";
export type CustodiaType = 1 | 2 | 3;

export interface SpedizioniInput {
  bancaleType: BancaleType;
  bloccoType: BloccoType;
  copieDaSpedire: number;
  copertinaType: CopertinaType;
  c18SpessoreCopertina: number;
  corrSegnatura: number;
  custodiaK33: number;
  custodiaP33: number;
  custodiaType: CustodiaType;
  d45GrammaturaRiguardi: number;
  d51Cartonato: boolean;
  e9BaseRifilato: number;
  f17AletteBrossura: number;
  f18Unghia: number;
  f23SpessoreCartoni: number;
  f24CopRisg: number;
  f25AletteOlandese: number;
  f9AltezzaRifilato: number;
  i11Pagine: number;
  i7Pagine: number;
  i9Pagine: number;
  i25CanaliniManuali: number;
  j11Grammatura: number;
  j29AletteSopracoperta: number;
  j7Grammatura: number;
  j9Grammatura: number;
  k11Vsa: number;
  k29RisvoltoSopracoperta: number;
  k7Vsa: number;
  k9Vsa: number;
  l11Segnature: number;
  l7Segnature: number;
  l9Segnature: number;
  maxAltezzaBancaleCm: number;
  maxPesoBancaleKg: number;
  maxScatolaAltezzaCm: number;
  maxScatolaPesoKg: number;
  sogliaFormatoMm: number;
  titolo: string;
  u17GrammaturaCover: number;
  u29GrammaturaJacket: number;
  sopracopertaType: SopracopertaType;
}

export interface LayoutBox {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface SpedizioniCalcolo {
  boxWeightKg: number;
  boxesPerLayer: number;
  copSheet: "Cop1" | "Cop2" | "Cop3" | "Cop4";
  copiesPerBox: number;
  copiesPerPallet: number;
  c125: 1 | 2 | 3;
  c126: 1 | 2;
  c127: 1 | 2;
  d52: number;
  d53: number;
  d54: number;
  f52: number;
  i23: number;
  i29: number;
  j23: number;
  k16: number;
  k23: number;
  l16: number;
  l25: number;
  m25: number;
  h16: number;
  h23: number;
  h29: number;
  h52: number;
  hasCopertinaCartonata: boolean;
  hasCustodia: boolean;
  hasSopracoperta: boolean;
  layoutBoxes: LayoutBox[];
  layoutScaleFactor: number;
  lastVisibleLayer: number;
  m54: number;
  m55: number;
  m56: number;
  m58: number;
  m59: number;
  n43: number;
  o23: number;
  o25: number;
  o29: number;
  outputBrossura: "BrossA" | "BrossN";
  palletHeightCm: number;
  palletWeightKg: number;
  palletWidthCm: number;
  p23: number;
  p25: number;
  p29: number;
  partialPalletWeightKg: number;
  pianiBancale: number;
  scatolaAltezzaCm: number;
  scatolaBaseCm: number;
  scatolaLunghezzaCm: number;
  sopSheet: "Sop1" | "Sop2";
  totalBoxesPerPallet: number;
  totalBookWeightGr: number;
  totalLayoutHeight: number;
  totalLayoutWidth: number;
}

const ceilTo = (value: number, step: number) => Math.ceil(value / step) * step;
const floorTo = (value: number, step: number) => Math.floor(value / step) * step;

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const asPositiveNumber = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

const evenClampFloor = (value: number) => {
  const floored = Math.floor(value);
  if (floored <= 4) {
    return Math.max(0, floored);
  }
  return floored % 2 === 0 ? floored : floored - 1;
};

const copertinaToC125 = (value: CopertinaType): 1 | 2 | 3 => {
  if (value === "quadro") return 1;
  if (value === "tondo") return 2;
  return 3;
};

const bloccoToC126 = (value: BloccoType): 1 | 2 => (value === "cucito" ? 1 : 2);
const sopracopertaToC127 = (value: SopracopertaType): 1 | 2 => (value === "normale" ? 1 : 2);

const grammaturaCartoni = (spessore: number) => {
  const map: Record<string, number> = {
    "1": 756,
    "1.5": 945,
    "2": 1260,
    "2.4": 1512,
    "2.5": 1512,
    "3": 1890,
    "3.5": 2205,
    "4": 2520,
  };
  const key = String(spessore);
  return map[key] ?? 0;
};

export const defaultSpedizioniInput: SpedizioniInput = {
  bancaleType: "100x120",
  bloccoType: "cucito",
  copieDaSpedire: 22000,
  copertinaType: "quadro",
  c18SpessoreCopertina: 1,
  corrSegnatura: 0.15,
  custodiaK33: 0,
  custodiaP33: 0,
  custodiaType: 1,
  d45GrammaturaRiguardi: 140,
  d51Cartonato: true,
  e9BaseRifilato: 241,
  f17AletteBrossura: 0,
  f18Unghia: 2,
  f23SpessoreCartoni: 2.4,
  f24CopRisg: 1.5,
  f25AletteOlandese: 0,
  f9AltezzaRifilato: 305,
  i11Pagine: 0,
  i7Pagine: 428,
  i9Pagine: 0,
  i25CanaliniManuali: 0,
  j11Grammatura: 0,
  j29AletteSopracoperta: 0,
  j7Grammatura: 135,
  j9Grammatura: 0,
  k11Vsa: 0,
  k29RisvoltoSopracoperta: 50,
  k7Vsa: 5,
  k9Vsa: 0,
  l11Segnature: 0,
  l7Segnature: 26,
  l9Segnature: 0,
  maxAltezzaBancaleCm: 160,
  maxPesoBancaleKg: 850,
  maxScatolaAltezzaCm: 45,
  maxScatolaPesoKg: 15,
  sogliaFormatoMm: 165,
  titolo: "",
  u17GrammaturaCover: 150,
  u29GrammaturaJacket: 150,
  sopracopertaType: "normale",
};

export const calcolaSpedizioni = (input: SpedizioniInput): SpedizioniCalcolo => {
  const c125 = copertinaToC125(input.copertinaType);
  const c126 = bloccoToC126(input.bloccoType);
  const c127 = sopracopertaToC127(input.sopracopertaType);

  const m7 = (input.i7Pagine / 2) * input.j7Grammatura * input.k7Vsa / 1000;
  const m9 = (input.i9Pagine / 2) * input.j9Grammatura * input.k9Vsa / 1000;
  const m11 = (input.i11Pagine / 2) * input.j11Grammatura * input.k11Vsa / 1000;
  const m8 = input.k7Vsa > 1 ? 0.75 : 1;
  const m10 = input.k9Vsa > 1 ? 0.75 : 1;
  const m12 = input.k11Vsa > 1 ? 0.75 : 1;

  const p16 = m7 + m9 + m11;
  const p18 = m7 + (input.l7Segnature * input.corrSegnatura * m8) + m9 + (input.l9Segnature * input.corrSegnatura * m10) + m11 + (input.l11Segnature * input.corrSegnatura * m12);

  const h16Base = input.c18SpessoreCopertina + (c126 === 1 ? p18 : p16) - 0.24;
  const h16 = c126 < 1 || p16 + p18 < 1 || input.c18SpessoreCopertina < 0.1 ? 0 : ceilTo(h16Base, 0.5);
  const k16 = h16 > 0 ? input.e9BaseRifilato * 2 + h16 + (input.f17AletteBrossura > 0 ? (input.f18Unghia + input.f17AletteBrossura) * 2 : 0) : 0;
  const l16 = h16 > 0 ? input.f9AltezzaRifilato : 0;
  const h16OrH23 = input.d51Cartonato ? h16 : h16;

  const j18 = h16 > 0 ? ceilTo(p16 + input.c18SpessoreCopertina + (input.f17AletteBrossura > 0 ? input.c18SpessoreCopertina * 0.75 : 0) - 0.24, 0.5) : 0;
  const k18 = h16 > 0 ? input.e9BaseRifilato + (input.f17AletteBrossura > 0 ? input.f18Unghia : 0) : 0;
  const l18 = h16 > 0 ? input.f9AltezzaRifilato : 0;

  const k23 = 16;
  let h23 = 0;
  if (h16 > 0 && k23 > 0 && c125 > 0 && input.f24CopRisg >= 0.1) {
    if (c125 !== 3 && input.f23SpessoreCartoni < 0.1) {
      h23 = 0;
    } else if (c125 === 3) {
      h23 = ceilTo(((c126 === 1 ? p18 : p16) + input.f24CopRisg * 1.5) * 1.1 - 0.248, 0.5);
    } else {
      const cucitoExtra = c126 === 1 && p18 - p16 - input.f23SpessoreCartoni > 0 ? p18 - p16 - input.f23SpessoreCartoni : 0;
      const ratio = c125 === 2 ? 1.1 : 1;
      h23 = ceilTo((p16 + input.f23SpessoreCartoni * 2 + input.f24CopRisg + cucitoExtra) * ratio - 0.248, 0.5);
    }
  }

  const i23 = h23 > 0
    ? (input.i25CanaliniManuali > 0
      ? input.i25CanaliniManuali
      : (c125 === 1 ? 8 + input.f23SpessoreCartoni : c125 === 3 ? 0 : 8))
    : 0;
  const j23Base = c125 === 1 ? input.e9BaseRifilato - 3 : c125 === 2 ? input.e9BaseRifilato - 4 : c125 === 3 ? input.e9BaseRifilato + 5 : 0;
  const i23Default = c125 === 1 ? 8 + input.f23SpessoreCartoni : c125 === 3 ? 0 : 8;
  const j23 = h23 > 0 ? j23Base + (input.i25CanaliniManuali > 0 ? (i23Default - input.i25CanaliniManuali) : 0) : 0;
  const o23 = h23 > 0 ? h23 + (i23 + j23 + k23) * 2 + (c125 === 3 && input.f25AletteOlandese > 0 ? input.f25AletteOlandese * 2 - k23 * 2 : 0) : 0;
  const p23 = h23 > 0 ? input.f9AltezzaRifilato + 7 + k23 * 2 : 0;

  const h29 = c127 === 2 && input.k29RisvoltoSopracoperta < 10
    ? 0
    : (h23 > 0 && input.j29AletteSopracoperta > 0 ? h23 + 1 : 0);
  const i29 = h29 > 0 ? j23 + i23 : 0;
  const o29 = h29 > 0 ? input.j29AletteSopracoperta * 2 + h29 + i29 * 2 : 0;
  const p29 = h29 > 0 ? input.f9AltezzaRifilato + 7 + (c127 === 2 ? input.k29RisvoltoSopracoperta * 2 : 0) : 0;

  const l25 = h23 > 0 ? ((c125 === 2 || c125 === 3 ? Math.floor(h23 * 0.91) : h23) + (h29 > 0 ? 0.5 : 0)) : 0;
  const m25 = h23 > 0 ? ceilTo((p16 + (c125 < 3 ? input.f23SpessoreCartoni * 2 + input.f24CopRisg : input.f24CopRisg * 1.5 + (input.f25AletteOlandese > 0 ? input.f24CopRisg / 3 : 0))) + (h29 > 0 ? 0.5 : 0) - 0.248, 0.5) : 0;
  const o25 = h23 > 0 ? (j23 + i23 + ((c125 === 2 || c125 === 3) ? round(h23 / 10, 1) : 0) + (h29 > 0 ? 0.5 : 0)) : 0;
  const p25 = h23 > 0 ? input.f9AltezzaRifilato + 8 : 0;

  const d34 = (input.e9BaseRifilato / 1000) * 2;
  const d35 = input.f9AltezzaRifilato / 1000;
  const d36 = grammaturaCartoni(input.f23SpessoreCartoni);

  const j35 = input.e9BaseRifilato > 0
    ? (input.e9BaseRifilato * input.f9AltezzaRifilato * input.j7Grammatura / 1_000_000) * input.i7Pagine / 2
      + ((input.e9BaseRifilato * input.f9AltezzaRifilato * input.j9Grammatura / 1_000_000) * input.i9Pagine / 2)
      + ((input.e9BaseRifilato * input.f9AltezzaRifilato * input.j11Grammatura / 1_000_000) * input.i11Pagine / 2)
    : 0;
  const n35 = j35;
  const j36 = (input.u29GrammaturaJacket > 0 && o29 > 0 && p29 > 0) ? (((input.u29GrammaturaJacket + 20) * o29 * p29) / 1_000_000) : 0;
  const n36 = (input.u17GrammaturaCover > 0 && k16 > 0 && l16 > 0) ? ((input.u17GrammaturaCover * k16 * l16) / 1_000_000) : 0;
  const d43 = input.e9BaseRifilato;
  const d44 = input.f9AltezzaRifilato;
  const j37 = (d43 > 0 && d44 > 0 && input.d45GrammaturaRiguardi > 0) ? (((d43 * d44 * input.d45GrammaturaRiguardi) / 1_000_000) * 4) : 0;
  const j38 = (d36 > 0 && d35 > 0 && d34 > 0) ? (d36 * d35 * d34) : 0;
  const j43 = j35 + j36 + j37 + j38;
  const n43 = n36 + n35;

  const soglia = input.sogliaFormatoMm;
  const eUnder = input.e9BaseRifilato < soglia;
  const fUnder = input.f9AltezzaRifilato < soglia;
  const underBoth = eUnder && fUnder;
  const underOne = (eUnder || fUnder) && !underBoth;
  const c126Thickness = input.d51Cartonato ? h23 : h16;

  const d52Calc = input.d51Cartonato
    ? Math.min(
      evenClampFloor(((input.maxScatolaAltezzaCm - 1) * 10) / Math.max(h23, 0.1)),
      evenClampFloor(((input.maxScatolaPesoKg - 0.5) * 1000) / Math.max(j43, 0.1)),
    )
    : Math.min(
      evenClampFloor(((input.maxScatolaAltezzaCm - 1) * 10) / Math.max(h16, 0.1)),
      evenClampFloor(((input.maxScatolaPesoKg - 0.5) * 1000) / Math.max(n43, 0.1)),
    );
  const d52 = (!eUnder && !fUnder) ? Math.max(0, d52Calc) : 0;

  const f52Calc = input.d51Cartonato
    ? 2 * Math.min(
      Math.floor((input.maxScatolaAltezzaCm * 10) / Math.max(h23, 0.1)),
      Math.floor((input.maxScatolaPesoKg * 1000) / Math.max(2 * j43, 0.1)),
    )
    : 2 * Math.min(
      Math.floor((input.maxScatolaAltezzaCm * 10) / Math.max(h16, 0.1)),
      Math.floor((input.maxScatolaPesoKg * 1000) / Math.max(2 * n43, 0.1)),
    );
  const f52 = underOne ? Math.max(0, f52Calc) : 0;

  const h52Calc = input.d51Cartonato
    ? 4 * Math.min(
      Math.floor((input.maxScatolaAltezzaCm * 10) / Math.max(h23, 0.1)),
      Math.floor((input.maxScatolaPesoKg * 1000) / Math.max(4 * j43, 0.1)),
    )
    : 4 * Math.min(
      Math.floor((input.maxScatolaAltezzaCm * 10) / Math.max(h16, 0.1)),
      Math.floor((input.maxScatolaPesoKg * 1000) / Math.max(4 * n43, 0.1)),
    );
  const h52 = underBoth ? Math.max(0, h52Calc) : 0;

  const copiesPerBox = underBoth ? h52 : underOne ? f52 : d52;

  const packsPerFile = underBoth ? h52 / 4 : underOne ? f52 / 2 : d52;
  const d58 = input.d51Cartonato
    ? (eUnder ? 2 * ((o25 + 15) / 10) + 1.5 : ((o25 + 15) / 10))
    : (eUnder ? 2 * ((k18 + 15) / 10) + 1.5 : ((k18 + 15) / 10));
  const f58 = input.d51Cartonato
    ? (fUnder ? 2 * ((p25 + 15) / 10) + 1.5 : ((p25 + 15) / 10))
    : (fUnder ? 2 * ((l18 + 15) / 10) + 1.5 : ((l18 + 15) / 10));
  const h58 = input.d51Cartonato ? (packsPerFile * h23) / 10 : (packsPerFile * h16) / 10;

  const d59 = d58 + 1.5;
  const f59 = f58 + 1.5;
  const h59 = input.d51Cartonato ? h58 : h58 + 1;

  const palletWidthCm = input.bancaleType === "80x120" ? 80 : 100;
  const palletHeightCm = 120;
  const d53 = Math.max(
    Math.floor(palletWidthCm / Math.max(d59, 0.1)) * Math.floor(palletHeightCm / Math.max(f59, 0.1)),
    Math.floor(palletWidthCm / Math.max(f59, 0.1)) * Math.floor(palletHeightCm / Math.max(d59, 0.1)),
  );

  const m54 = input.d51Cartonato
    ? (copiesPerBox * j43 / 1000 + 0.5)
    : (copiesPerBox * n43 / 1000 + 0.5);

  const countByHeight = Math.max(0, Math.floor((input.maxAltezzaBancaleCm - 20) / Math.max(h59, 0.1)));
  const countByWeight = d53 > 0 && m54 > 0
    ? Math.max(0, Math.min(14, Math.floor((input.maxPesoBancaleKg - 35) / (d53 * m54))))
    : 0;
  const d54 = Math.max(0, Math.min(countByHeight, countByWeight));

  const m52 = d54 * d53 * copiesPerBox;
  const m53 = d54 * d53;
  const m55 = ceilTo((m54 * m53) + 35, 1);
  const m56 = (h59 * d54) + 20;
  const m58 = m52 > 0 ? floorTo(input.copieDaSpedire / m52, 1) : 0;
  const partialCopies = input.copieDaSpedire - m52 * Math.floor(input.copieDaSpedire / Math.max(m52, 1));
  const m59 = partialCopies > 0 && copiesPerBox > 0 ? ceilTo(partialCopies / copiesPerBox, 1) * m54 + 35 : 0;

  const c26 = (c125 + (input.f25AletteOlandese > 0 ? 1 : 0));
  const copSheet = (c26 === 1 ? "Cop1" : c26 === 2 ? "Cop2" : c26 === 3 ? "Cop3" : "Cop4");
  const outputBrossura = input.f17AletteBrossura > 0 ? "BrossA" : "BrossN";
  const sopSheet = c127 === 1 ? "Sop1" : "Sop2";

  const boxesByOrientation1 = {
    boxesX: Math.floor(palletWidthCm / Math.max(d59, 0.1)),
    boxesY: Math.floor(palletHeightCm / Math.max(f59, 0.1)),
    h: f59,
    total: Math.floor(palletWidthCm / Math.max(d59, 0.1)) * Math.floor(palletHeightCm / Math.max(f59, 0.1)),
    w: d59,
  };
  const boxesByOrientation2 = {
    boxesX: Math.floor(palletWidthCm / Math.max(f59, 0.1)),
    boxesY: Math.floor(palletHeightCm / Math.max(d59, 0.1)),
    h: d59,
    total: Math.floor(palletWidthCm / Math.max(f59, 0.1)) * Math.floor(palletHeightCm / Math.max(d59, 0.1)),
    w: f59,
  };
  const orientation = boxesByOrientation1.total >= boxesByOrientation2.total ? boxesByOrientation1 : boxesByOrientation2;
  const arrW = orientation.boxesX * orientation.w;
  const arrH = orientation.boxesY * orientation.h;
  const layoutScaleFactor = arrW > palletWidthCm || arrH > palletHeightCm
    ? Math.min(palletWidthCm / Math.max(arrW, 0.1), palletHeightCm / Math.max(arrH, 0.1))
    : 1;
  const marginFactor = 1.05;
  const totalLayoutWidth = palletWidthCm * marginFactor;
  const totalLayoutHeight = palletHeightCm * marginFactor;
  const scaledArrW = arrW * layoutScaleFactor;
  const scaledArrH = arrH * layoutScaleFactor;
  const offsetX = (totalLayoutWidth - scaledArrW) / 2;
  const offsetY = (totalLayoutHeight - scaledArrH) / 2;

  const layoutBoxes: LayoutBox[] = [];
  for (let row = 0; row < orientation.boxesY; row += 1) {
    for (let col = 0; col < orientation.boxesX; col += 1) {
      layoutBoxes.push({
        h: orientation.h * layoutScaleFactor,
        w: orientation.w * layoutScaleFactor,
        x: offsetX + col * orientation.w * layoutScaleFactor,
        y: offsetY + row * orientation.h * layoutScaleFactor,
      });
    }
  }

  return {
    boxWeightKg: round(m54, 2),
    boxesPerLayer: d53,
    copSheet,
    copiesPerBox,
    copiesPerPallet: m52,
    c125,
    c126,
    c127,
    d52,
    d53,
    d54,
    f52,
    i23: round(i23, 2),
    i29: round(i29, 2),
    j23: round(j23, 2),
    k16: round(k16, 2),
    k23,
    l16: round(l16, 2),
    l25: round(l25, 2),
    m25: round(m25, 2),
    h16: round(h16, 2),
    h23: round(h23, 2),
    h29: round(h29, 2),
    h52,
    hasCopertinaCartonata: h23 > 0,
    hasCustodia: input.custodiaK33 > 0 || input.custodiaP33 > 0,
    hasSopracoperta: h29 > 0,
    layoutBoxes,
    layoutScaleFactor: round(layoutScaleFactor, 4),
    lastVisibleLayer: d54,
    m54: round(m54, 2),
    m55: round(m55, 2),
    m56: round(m56, 2),
    m58,
    m59: round(m59, 2),
    n43: round(n43, 2),
    o23: round(o23, 2),
    o25: round(o25, 2),
    o29: round(o29, 2),
    outputBrossura,
    palletHeightCm,
    palletWeightKg: round(m55, 2),
    palletWidthCm,
    p23: round(p23, 2),
    p25: round(p25, 2),
    p29: round(p29, 2),
    partialPalletWeightKg: round(m59, 2),
    pianiBancale: d54,
    scatolaAltezzaCm: round(h59, 2),
    scatolaBaseCm: round(d59, 2),
    scatolaLunghezzaCm: round(f59, 2),
    sopSheet,
    totalBookWeightGr: round(input.d51Cartonato ? j43 : n43, 2),
    totalBoxesPerPallet: m53,
    totalLayoutHeight: round(totalLayoutHeight, 2),
    totalLayoutWidth: round(totalLayoutWidth, 2),
  };
};

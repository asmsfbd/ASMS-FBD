/**
 * NR Word Document Generator — Official RSSB Faridabad Format (v3)
 *
 * Changes from v2:
 *  - "Name of Satsang Place" now shows "FARIDABAD | <centres>"
 *  - Duration row: "Sewa Duration : N Days" format
 *  - Blank row after duration table removed
 *  - Sno and Age columns: tight padding, no text wrap
 *  - Sign of Jathedar label column wider (fits in one line)
 *  - Sig + Arrival blocks pushed to page bottom via spacer
 *  - Arrival/Departure: full ordinal date + time ("1st April 2025, 03:20 PM")
 *  - arrival_time / departure_time fields added to NRForWord
 *
 * Deps:  npm install docx file-saver
 *        npm install --save-dev @types/file-saver
 * Logo:  /public/logo.png
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} from 'docx'
import { saveAs } from 'file-saver'

// ─── Public types ─────────────────────────────────────────────────────────────
export interface NRForWord {
  id:               number
  centre:           string
  jatha_name:       string | null
  destination:      string | null
  department:       string | null
  from_date:        string | null
  to_date:          string | null
  jathedar_name:    string | null
  jathedar_phone:   string | null
  vehicle_type:     string | null
  driver_name:      string | null
  driver_mobile:    string | null
  member_count:     number
  male_count:       number
  female_count:     number
  /** e.g. "03:20 PM" — shown in Arrival Date & Time row */
  arrival_time?:    string | null
  /** e.g. "03:20 PM" — shown in Departure Date & Time row */
  departure_time?:  string | null
}

export interface SectionForWord {
  centre:   string
  srs_id:   string | null
  is_ready: boolean
  members:  MemberForWord[]
}

export interface MemberForWord {
  serial_no:           number
  display_id:          string
  name:                string
  father_name:         string | null
  gender:              string
  age:                 number | null
  address:             string | null
  mobile:              string | null
  is_jathedar:         boolean
  contributing_centre: string
  member_type:         'sewadar' | 'sangat'
  aadhaar_masked:      string | null
}

export interface GenerateWordOptions {
  nr:       NRForWord
  sections: SectionForWord[]
  jathedar: MemberForWord | null
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const CW = 10466  // A4 content width: 11906 − 720 − 720

// ─── Borders ─────────────────────────────────────────────────────────────────
const NO: any = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' }
const S4: any = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

const noBd     = () => ({ top: NO, bottom: NO, left: NO, right: NO })
const allBd    = () => ({ top: S4, bottom: S4, left: S4, right: S4 })
const botBd    = () => ({ top: NO, bottom: S4, left: NO, right: NO })
const topBotBd = () => ({ top: S4, bottom: S4, left: NO, right: NO })
const topBd    = () => ({ top: S4, bottom: NO, left: NO, right: NO })

// ─── Helpers ──────────────────────────────────────────────────────────────────
interface CO { w?: number; bd?: any; va?: any; fill?: string; span?: number; rspan?: number; pad?: any }
function tc(children: Paragraph[], o: CO = {}): TableCell {
  return new TableCell({
    width:         o.w !== undefined ? { size: o.w, type: WidthType.DXA } : undefined,
    borders:       o.bd ?? allBd(),
    verticalAlign: o.va ?? VerticalAlign.CENTER,
    shading:       { fill: o.fill ?? 'FFFFFF', type: ShadingType.CLEAR },
    margins:       o.pad ?? { top: 40, bottom: 40, left: 80, right: 80 },
    columnSpan:    o.span,
    rowSpan:       o.rspan,
    children,
  })
}

interface PO { b?: boolean; sz?: number; align?: any }
function p(text: string, o: PO = {}): Paragraph {
  return new Paragraph({
    alignment: o.align ?? AlignmentType.LEFT,
    spacing:   { before: 0, after: 0 },
    children:  [new TextRun({ text: text ?? '', bold: o.b ?? false, size: o.sz ?? 20, font: 'Arial' })],
  })
}

function gap(before = 80): Paragraph {
  return new Paragraph({ spacing: { before, after: 0 }, children: [] })
}

// ─── Date utils ───────────────────────────────────────────────────────────────
function fd(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`
}

/** Returns "1st April 2025, 03:20 PM" */
function fdFull(d: string | null, timeStr?: string | null): string {
  if (!d) return timeStr || ''
  const dt  = new Date(d)
  const day = dt.getDate()
  const sfx = ['th','st','nd','rd'][(day > 3 && day < 21) ? 0 : [0,1,2,3,0,0,0,0,0,0][day % 10]!] || 'th'
  const MON = ['January','February','March','April','May','June',
               'July','August','September','October','November','December']
  const base = `${day}${sfx} ${MON[dt.getMonth()]} ${dt.getFullYear()}`
  return timeStr ? `${base}, ${timeStr}` : base
}

function today(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

function days(f: string | null, t: string | null): string {
  if (!f || !t) return '1'
  return String(Math.round((new Date(t).getTime() - new Date(f).getTime()) / 86400000) + 1)
}

async function loadLogo(): Promise<ArrayBuffer | null> {
  try { const r = await fetch('/logo.png'); return r.ok ? r.arrayBuffer() : null }
  catch { return null }
}

// ─── Sheet builder ────────────────────────────────────────────────────────────
interface SheetResult { bodyContent: (Paragraph | Table)[]; footerContent: (Paragraph | Table)[] }

function buildSheet(
  nr:      NRForWord,
  sections: SectionForWord[],
  gender:  'M' | 'F',
  logo:    ArrayBuffer | null,
): SheetResult | null {

  const label = gender === 'M' ? 'MALE' : 'FEMALE'
  const gSecs = sections
    .map(s => ({ ...s, members: s.members.filter(m => m.gender === gender) }))
    .filter(s => s.members.length > 0)
  if (!gSecs.length) return null

  const isT    = (nr.vehicle_type ?? '').toUpperCase() === 'TRAIN'
  const drvLbl = isT ? 'Train Name & Time' : "Driver's Name & Mobile"
  const drvVal = [nr.driver_name, nr.driver_mobile].filter(Boolean).join(' | ')

  const place  = 'FARIDABAD'
  const GREY   = 'D9D9D9'

  // ── 1. HEADER ───────────────────────────────────────────────────────────────
  const LW = 1100, SCI = 1500, TW = CW - LW - SCI
  const headerTable = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [LW, TW, SCI],
    borders: { top: NO, bottom: NO, left: NO, right: NO, insideH: NO, insideV: NO },
    rows: [new TableRow({ children: [
      tc(logo ? [new Paragraph({ spacing: { before: 0, after: 0 }, children: [
        new ImageRun({ data: logo, transformation: { width: 52, height: 62 }, type: 'png' })
      ]})] : [p('')], { w: LW, bd: noBd(), va: VerticalAlign.CENTER }),
      tc([
        p('SATSANG CENTRES IN INDIA',      { b: true, sz: 28, align: AlignmentType.CENTER }),
        p(`NOMINAL ROLL OF JATHA ${label}`, { b: true, sz: 24, align: AlignmentType.CENTER }),
      ], { w: TW, bd: noBd(), va: VerticalAlign.CENTER }),
      tc([p('SCI/2020/84', { sz: 16, align: AlignmentType.RIGHT })],
        { w: SCI, bd: noBd(), va: VerticalAlign.TOP }),
    ]})],
  })

  // ── 2. INFO TABLE ───────────────────────────────────────────────────────────
  const IC = [2100, 200, 2200, 2300, 200, 3466]
  const infoRow = (l1: string, v1: string, l2: string, v2: string) =>
    new TableRow({ children: [
      tc([p(l1)],                                          { w: IC[0], bd: noBd() }),
      tc([p(':')],                                          { w: IC[1], bd: noBd() }),
      tc([p(v1, { b: true })],                              { w: IC[2], bd: botBd() }),
      tc([p(l2)],                                          { w: IC[3], bd: noBd() }),
      tc([p(':')],                                          { w: IC[4], bd: noBd() }),
      tc([p(v2, { b: true, align: AlignmentType.CENTER })], { w: IC[5], bd: botBd() }),
    ]})

  const infoTable = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: IC,
    borders: { top: NO, bottom: NO, left: NO, right: NO, insideH: NO, insideV: NO },
    rows: [
      infoRow('Name of Satsang Place', place,                'Area : FARIDABAD',      'ZONE - III'),
      infoRow('Name of Jathedar',      nr.jathedar_name??'', drvLbl,                  drvVal),
      infoRow('Mobile No',             nr.jathedar_phone??'','Vehicle Type / Number', nr.vehicle_type??''),
      infoRow('Place of Sewa',         nr.destination??'',   'Department',            (nr.department??'').toUpperCase()),
    ],
  })

  // ── 3. DURATION TABLE — FIX 2 + FIX 3 ──────────────────────────────────────
  // "Sewa Duration : N Days" | "Date (From) : dd-mm-yyyy" | "Date (To) : dd-mm-yyyy"
  // Single row only — blank row removed
  const th = Math.floor(CW / 3)
  const DC = [th, th, CW - 2*th]
  const durTable = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: DC,
    rows: [new TableRow({ children: [
      tc([p(`Sewa Duration :  ${days(nr.from_date, nr.to_date)} Days`, { sz: 20, align: AlignmentType.CENTER })], { w: DC[0] }),
      tc([p(`Date ( From ) :  ${fd(nr.from_date)}`, { sz: 20, align: AlignmentType.CENTER })], { w: DC[1] }),
      tc([p(`Date ( To ) :  ${fd(nr.to_date)}`,     { sz: 20, align: AlignmentType.CENTER })], { w: DC[2] }),
    ]})],
  })

  // ── 4. MEMBER TABLE — FIX 4: Sno + Age tight padding ───────────────────────
  const MC = [440, 1700, 1400, 1300, 380, 340, 2806, 2100]
  const hCell = (lines: string[], w: number, tightPad = false) =>
    tc(lines.map(t => p(t, { b: true, sz: 19, align: AlignmentType.CENTER })),
      { w, fill: GREY, pad: tightPad
        ? { top: 60, bottom: 60, left: 20, right: 20 }
        : { top: 60, bottom: 60, left: 80, right: 80 } })

  const hRow = new TableRow({ children: [
    hCell(['Sno'],                          MC[0], true),   // tight — no wrap
    hCell(['Badge Number /', 'Aadhaar No'], MC[1]),
    hCell(["Sewadar's Name"],               MC[2]),
    hCell(["Father's Name"],                MC[3]),
    hCell(['M/F'],                          MC[4]),
    hCell(['Age'],                          MC[5], true),   // tight — no wrap
    hCell(['Address & Phone No'],           MC[6]),
    hCell(['Centre \\ SRS Id'],             MC[7]),
  ]})

  const allM = gSecs.flatMap(s => s.members.map(m => ({ ...m, _srs: s.srs_id ?? '—', _ctr: s.centre })))
  allM.sort((a, b) => {
    if (a.is_jathedar && !b.is_jathedar) return -1
    if (!a.is_jathedar && b.is_jathedar) return 1
    return a.name.localeCompare(b.name)
  })

  const mRows = allM.map((m, i) => {
    const id  = m.member_type === 'sangat' && m.aadhaar_masked ? m.aadhaar_masked : m.display_id
    const adr = [m.address, m.mobile].filter(Boolean).join('\n')
    const ALT = i % 2 !== 0 ? 'F2F2F2' : 'FFFFFF'
    const TIGHT = { top: 40, bottom: 40, left: 20, right: 20 }
    return new TableRow({ children: [
      tc([p(String(i+1), { sz: 19, align: AlignmentType.CENTER })],
        { w: MC[0], fill: ALT, pad: TIGHT }),
      tc([p(id, { sz: 19 })], { w: MC[1], fill: ALT }),
      tc([p(m.name, { sz: 19, b: m.is_jathedar })], { w: MC[2], fill: ALT }),
      tc([p(m.father_name ?? '—', { sz: 19 })], { w: MC[3], fill: ALT }),
      tc([p(m.gender, { sz: 19, align: AlignmentType.CENTER })], { w: MC[4], fill: ALT }),
      tc([p(m.age != null ? String(m.age) : '—', { sz: 19, align: AlignmentType.CENTER })],
        { w: MC[5], fill: ALT, pad: TIGHT }),
      tc([p(adr, { sz: 19 })], { w: MC[6], fill: ALT }),
      tc([p(`${m._ctr}\n${m._srs}`, { sz: 19, align: AlignmentType.CENTER })], { w: MC[7], fill: ALT }),
    ]})
  })

  const gM = allM.filter(m => m.gender === 'M').length
  const gF = allM.filter(m => m.gender === 'F').length
  const gT = allM.length

  const totRow1 = new TableRow({ children: [
    new TableCell({ columnSpan: 3, rowSpan: 2,
      width: { size: MC[0]+MC[1]+MC[2], type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER, borders: allBd(),
      shading: { fill: GREY, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [p('TOTAL SEWADARS', { b: true, sz: 20, align: AlignmentType.CENTER })] }),
    new TableCell({ rowSpan: 2,
      width: { size: MC[3], type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER, borders: allBd(),
      shading: { fill: GREY, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [p(String(gT), { b: true, sz: 20, align: AlignmentType.CENTER })] }),
    tc([p('M', { b: true, sz: 20, align: AlignmentType.CENTER })], { w: MC[4], fill: GREY }),
    tc([p('F', { b: true, sz: 20, align: AlignmentType.CENTER })], { w: MC[5], fill: GREY }),
    new TableCell({ columnSpan: 2, rowSpan: 2,
      width: { size: MC[6]+MC[7], type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER, borders: allBd(),
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [p('')] }),
  ]})
  const totRow2 = new TableRow({ children: [
    tc([p(String(gM), { b: true, sz: 20, align: AlignmentType.CENTER })], { w: MC[4], fill: GREY }),
    tc([p(String(gF), { b: true, sz: 20, align: AlignmentType.CENTER })], { w: MC[5], fill: GREY }),
  ]})

  const memberTable = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: MC, layout: 'fixed' as any,
    rows: [hRow, ...mRows, totRow1, totRow2],
  })

  // ── 5. SIGNATURE BLOCK — FIX 5: wider label col ─────────────────────────────
  const JW = 4300, GW = 2066, SW = CW - JW - GW  // 4100
  // FIX 5: JLC=1800 so "Sign of Jathedar" (16 chars @ ~8px = 128px) fits on one line
  const JLC = 1800, JVC = JW - JLC

  const jathSub = new Table({
    width: { size: JW, type: WidthType.DXA }, columnWidths: [JLC, JVC],
    borders: { top: NO, bottom: NO, left: NO, right: NO, insideH: NO, insideV: NO },
    rows: [
      { label: 'Sign of Jathedar', val: ''                     },
      { label: 'Name',             val: nr.jathedar_name ?? '' },
      { label: 'Date',             val: ''                     },
    ].map(({ label, val }) => new TableRow({ children: [
      tc([p(label, { sz: 20 })],           { w: JLC, bd: noBd() }),
      tc([p(val,   { sz: 20, b: !!val })], { w: JVC, bd: botBd() }),
    ]})),
  })

  const secSub = new Table({
    width: { size: SW, type: WidthType.DXA }, columnWidths: [SW],
    borders: { top: NO, bottom: NO, left: NO, right: NO, insideH: NO, insideV: NO },
    rows: [
      new TableRow({ children: [tc([p('')], { w: SW, bd: botBd(), pad: { top: 60, bottom: 60, left: 80, right: 80 } })] }),
      new TableRow({ children: [tc([p('Secretary / Area Secretary', { sz: 20, align: AlignmentType.CENTER })], { w: SW, bd: noBd() })] }),
      new TableRow({ children: [tc([p(`(Stamp) Dated: - ${today()}`, { sz: 20, align: AlignmentType.CENTER })], { w: SW, bd: noBd() })] }),
    ],
  })

  const sigTable = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [JW, GW, SW],
    borders: { top: NO, bottom: NO, left: NO, right: NO, insideH: NO, insideV: NO },
    rows: [new TableRow({ children: [
      tc([jathSub], { w: JW, bd: noBd(), va: VerticalAlign.TOP }),
      tc([p('')],    { w: GW, bd: noBd() }),
      tc([secSub],  { w: SW,  bd: noBd(), va: VerticalAlign.TOP }),
    ]})],
  })

  const divider = new Paragraph({
    spacing: { before: 80, after: 80 },
    border:  { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '000000', space: 1 } },
    children:[new TextRun({ text: '', size: 4 })],
  })

  // ── 6. ARRIVAL/DEPARTURE — FIX 7: full date + time, wide value col ───────────
  const arrTime = nr.arrival_time   || '03:00 PM'
  const depTime = nr.departure_time || '03:00 PM'
  const AC  = [2400, 200, CW - 2600]   // value col = 7866 — wide enough for full date
  const arrRow = (lbl: string, val: string) => new TableRow({ children: [
    tc([p(lbl, { sz: 20, b: true })], { w: AC[0], bd: noBd() }),
    tc([p(':')],                        { w: AC[1], bd: noBd() }),
    tc([p(val, { sz: 20 })],            { w: AC[2], bd: noBd() }),
  ]})

  const arrTable = new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: AC,
    borders: { top: NO, bottom: NO, left: NO, right: NO, insideH: NO, insideV: NO },
    rows: [
      arrRow('Arrival Date & Time',   fdFull(nr.from_date, arrTime)),
      arrRow('Departure Date & Time', fdFull(nr.to_date,   depTime)),
    ],
  })

  const divider2 = new Paragraph({
    spacing: { before: 80, after: 0 },
    border:  { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '000000', space: 1 } },
    children:[new TextRun({ text: '', size: 4 })],
  })

  const bodyContent:   (Paragraph | Table)[] = [headerTable, gap(80), infoTable, gap(80), durTable, gap(40), memberTable]
  const footerContent: (Paragraph | Table)[] = [gap(120), sigTable, divider, arrTable, divider2]

  return { bodyContent, footerContent }
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateNRDocx(opts: GenerateWordOptions): Promise<void> {
  const { nr, sections } = opts
  const logo = await loadLogo()

  const pageProps = {
    size:   { width: 11906, height: 16838 },
    margin: { top: 568, right: 720, bottom: 568, left: 720 },
  }

  const docSections: any[] = []

  for (const gender of ['M', 'F'] as const) {
    const result = buildSheet(nr, sections, gender, logo)
    if (!result) continue

    const { bodyContent, footerContent } = result

    // FIX 6: Large spacer paragraph pushes footer to bottom of page.
    // 2800 DXA ≈ ~5cm space — enough for typical 10–40 member NRs.
    // For very large NRs the spacer auto-collapses since the table already fills the page.
    const spacer = new Paragraph({ spacing: { before: 2800, after: 0 }, children: [] })

    docSections.push({
      properties: { page: pageProps },
      children:   [...bodyContent, spacer, ...footerContent],
    })
  }

  if (!docSections.length) throw new Error('No members to generate NR for')

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: docSections,
  })

  const buf  = await Packer.toBuffer(doc)
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  saveAs(blob, `${(nr.jatha_name ?? 'NR').replace(/[^a-zA-Z0-9_\- ]/g,'').replace(/\s+/g,'_')}_NR.docx`)
}

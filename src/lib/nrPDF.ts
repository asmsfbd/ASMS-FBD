/**
 * NR PDF — Official RSSB Faridabad Format
 * Pure browser-native: jsPDF + jspdf-autotable
 * No server, no CORS, works everywhere
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// RSSB Logo embedded as base64
const LOGO_B64 = 'data:image/png;base64,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'

export interface NRForPDF {
  id: number; centre: string; jatha_name: string | null
  destination: string | null; department: string | null
  from_date: string | null; to_date: string | null
  jathedar_name: string | null; jathedar_phone: string | null
  vehicle_type: string | null; driver_name: string | null
  driver_mobile: string | null; member_count: number
  male_count: number; female_count: number
}
export interface SectionForPDF {
  centre: string; srs_id: string | null
  is_ready: boolean; members: MemberForPDF[]
}
export interface MemberForPDF {
  serial_no: number; display_id: string; name: string
  father_name: string | null; gender: string; age: number | null
  address: string | null; mobile: string | null
  is_jathedar: boolean; contributing_centre: string
}
export interface GeneratePDFOptions {
  nr: NRForPDF; sections: SectionForPDF[]; jathedar: MemberForPDF | null
}

// ── Helpers ───────────────────────────────────────────────────
const BLACK  = [0,0,0]       as [number,number,number]
const GREY   = [204,204,204] as [number,number,number]
const WHITE  = [255,255,255] as [number,number,number]
const ALTROW = [247,247,247] as [number,number,number]

function fmtDate(d: string | null): string {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`
  } catch { return d }
}

function daysBetween(f: string | null, t: string | null): string {
  if (!f || !t) return '1'
  const diff = Math.round((new Date(t).getTime() - new Date(f).getTime()) / 86400000) + 1
  return String(diff)
}

function today(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

// ── Page constants (A4 portrait in mm) ───────────────────────
const PW = 210; const PH = 297
const ML = 12;  const MR = 12; const MT = 10; const MB = 10
const CW = PW - ML - MR   // 186mm

// Logo
const LOGO_W = 16; const LOGO_H = LOGO_W * (177/148)  // ~19.1mm

// Header block col widths (6 cols: lbl|:|val|lbl|:|val)
const HC_LBL1 = CW * 0.155; const HC_COL1 = 4; const HC_VAL1 = CW * 0.50 - HC_LBL1 - HC_COL1
const HC_LBL2 = CW * 0.175; const HC_COL2 = 4; const HC_VAL2 = CW * 0.50 - HC_LBL2 - HC_COL2

// Member table col widths
const C0 = CW*0.042; const C1 = CW*0.120; const C2 = CW*0.130; const C3 = CW*0.115
const C4 = CW*0.038; const C5 = CW*0.038
const rem = CW - C0 - C1 - C2 - C3 - C4 - C5
const C6 = rem*0.62; const C7 = rem*0.38
const COL_W = [C0,C1,C2,C3,C4,C5,C6,C7]

// Signature cols
const SIG_A = C0+C1; const SIG_B = C2+C3
const SIG_C = C4+C5+(C6*0.60); const SIG_E = C6*0.40+C7

// Footer height reserved at bottom
const FOOTER_H = 52  // mm

function renderSheet(
  doc: jsPDF,
  nr: NRForPDF,
  sections: SectionForPDF[],
  jathedar: MemberForPDF | null,
  genderFilter: 'M' | 'F',
  label: 'MALE' | 'FEMALE',
  isFirstPage: boolean
) {
  // Filter sections
  const secs = sections
    .map(s => ({ ...s, members: s.members.filter(m => m.gender.toUpperCase() === genderFilter) }))
    .filter(s => s.members.length > 0)
  if (secs.length === 0) return

  if (!isFirstPage) doc.addPage()

  const jath = secs.flatMap(s => s.members).find(m => m.is_jathedar) ?? jathedar
  const place = sections.map(s => s.centre).join(' | ').toUpperCase()
  const isT = (nr.vehicle_type ?? '').toUpperCase() === 'TRAIN'
  const drvLbl = isT ? 'Train Name & Time' : 'Name of Driver & Mobile No'
  const drvV = nr.driver_name ? `${nr.driver_name}${nr.driver_mobile ? ' | '+nr.driver_mobile : ''}` : ''

  let y = MT

  // ── Logo (overlay, top-left) ────────────────────────────────
  doc.addImage(LOGO_B64, 'PNG', ML, MT, LOGO_W, LOGO_H)

  // ── SCI/2020/84 top right ───────────────────────────────────
  doc.setFontSize(7); doc.setFont('helvetica','normal')
  doc.setTextColor(80,80,80)
  doc.text('SCI/2020/84', PW - MR, y + 3, { align: 'right' })
  doc.setTextColor(0,0,0)
  y += 4

  // ── Titles centred ──────────────────────────────────────────
  doc.setFontSize(11); doc.setFont('helvetica','bold')
  doc.text('SATSANG CENTRES IN INDIA', PW/2, y + 5, { align: 'center' })
  y += 7
  doc.setFontSize(9)
  doc.text(`NOMINAL ROLL OF JATHA ${label}`, PW/2, y + 4, { align: 'center' })
  y += 6

  // Spacer to clear logo bottom
  const logoBottom = MT + LOGO_H
  if (y < logoBottom) y = logoBottom + 2

  // ── Header info table (6 cols: lbl|:|val|lbl|:|val) ─────────
  const jathName = (jath?.name ?? '').toUpperCase()
  const jathMobile = jath?.mobile ?? ''
  const dest = (nr.destination ?? 'BEAS').toUpperCase()
  const dept = (nr.department ?? '').toUpperCase()
  const veh  = nr.vehicle_type ?? ''

  const hdrRows = [
    ['Name of Satsang Place',':',place, 'Area : FARIDABAD',':','ZONE: III'],
    ['Name of Jathedar',     ':',jathName, drvLbl,':',drvV],
    ['Mobile No',            ':',jathMobile, 'Type of Vehicle / Vehicle No',':',veh],
    ['Place of Sewa',        ':',dest, 'Department',':',dept],
  ]
  const hdrColW = [HC_LBL1, HC_COL1, HC_VAL1, HC_LBL2, HC_COL2, HC_VAL2]

  autoTable(doc, {
    startY: y,
    body: hdrRows,
    columnStyles: {
      0: { cellWidth: hdrColW[0], fontStyle: 'normal',  textColor: BLACK },
      1: { cellWidth: hdrColW[1], fontStyle: 'normal',  halign: 'center', textColor: BLACK },
      2: { cellWidth: hdrColW[2], fontStyle: 'bold',    textColor: BLACK },
      3: { cellWidth: hdrColW[3], fontStyle: 'normal',  textColor: BLACK },
      4: { cellWidth: hdrColW[4], fontStyle: 'normal',  halign: 'center', textColor: BLACK },
      5: { cellWidth: hdrColW[5], fontStyle: 'bold',    textColor: BLACK },
    },
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: { top:3, bottom:3, left:3, right:2 }, valign: 'bottom' },
    margin: { left: ML, right: MR },
    tableWidth: CW,
    didDrawCell: (data) => {
      // Underline only on value cols (2 and 5)
      if (data.section === 'body' && (data.column.index === 2 || data.column.index === 5)) {
        const { x, y: cy, width, height } = data.cell
        doc.setDrawColor(...GREY)
        doc.setLineWidth(0.3)
        doc.line(x, cy + height, x + width, cy + height)
      }
    },
  })

  y = (doc as any).lastAutoTable.finalY + 2

  // ── Member table ─────────────────────────────────────────────
  const allMembers = secs.flatMap(s =>
    s.members.map(m => ({ ...m, _centre: s.centre, _srs: s.srs_id }))
  )
  const days = daysBetween(nr.from_date, nr.to_date)

  // Row 0: Sewa duration (spans)
  // Row 1: Column headers
  // Rows 2+: data
  // Last 2: totals

  const mc = allMembers.filter(m => m.gender.toUpperCase() === 'M').length
  const fc = allMembers.filter(m => m.gender.toUpperCase() === 'F').length
  const tot = nr.member_count ?? (mc + fc)

  const dataRows = allMembers.map((m, idx) => {
    let age = ''
    try { age = m.age != null ? String(Math.floor(Number(m.age))) : '—' } catch { age = '—' }
    const addr = [m.address ?? '—', m.mobile ?? ''].filter(Boolean).join('\n')
    return [
      String(idx + 1),
      m.display_id,
      m.name,
      m.father_name ?? '—',
      m.gender,
      age,
      addr,
      `${m._centre}\n${m._srs ?? '—'}`,
    ]
  })

  // Total rows (2 rows merged)
  const tot1 = ['', '', 'TOTAL SEWADARS', '', 'M', 'F', genderFilter === 'M' ? String(tot) : String(tot), '']
  const tot2 = ['', '', '',               '', genderFilter === 'M' ? String(mc) : '', String(fc), '', '']

  const tableBody = [
    // Sewa duration row
    [
      `Sewa duration (No_Of_Days)   ${days} Days`,
      '', '',
      `Date ( From ) :  ${fmtDate(nr.from_date)}`,
      '', '',
      `Date ( To ) :  ${fmtDate(nr.to_date)}`,
      '',
    ],
    // Header row
    ['Sno','Badge No.\nAadhar No.',"Sewadar's Name","Father's Name",'M/F','Age','Address & Phone No.','Centre / SRS ID'],
    ...dataRows,
    tot1,
    tot2,
  ]

  const de = 2 + dataRows.length  // index of first total row

  autoTable(doc, {
    startY: y,
    body: tableBody,
    columnStyles: {
      0: { cellWidth: COL_W[0], halign: 'center' },
      1: { cellWidth: COL_W[1] },
      2: { cellWidth: COL_W[2] },
      3: { cellWidth: COL_W[3] },
      4: { cellWidth: COL_W[4], halign: 'center' },
      5: { cellWidth: COL_W[5], halign: 'center' },
      6: { cellWidth: COL_W[6] },
      7: { cellWidth: COL_W[7], halign: 'center' },
    },
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: { top:2, bottom:2, left:2, right:2 },
      lineColor: GREY,
      lineWidth: 0.3,
      textColor: BLACK,
      valign: 'top',
    },
    margin: { left: ML, right: MR },
    tableWidth: CW,
    didParseCell: (data) => {
      const ri = data.row.index

      // ── Sewa duration row (row 0) ──────────────────────────
      if (ri === 0) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.valign    = 'middle'
        data.cell.styles.fillColor = WHITE
        // Span col 0-2 for label+days, col 3-5 for From, col 6-7 for To
        if (data.column.index === 0) {
          (data.cell as any).colSpan = 3
        } else if (data.column.index === 3) {
          (data.cell as any).colSpan = 3
        } else if (data.column.index === 6) {
          (data.cell as any).colSpan = 2
        }
      }

      // ── Header row (row 1) ─────────────────────────────────
      if (ri === 1) {
        data.cell.styles.fontStyle  = 'bold'
        data.cell.styles.halign     = 'center'
        data.cell.styles.valign     = 'middle'
        data.cell.styles.fillColor  = WHITE
      }

      // ── Alternating data rows ──────────────────────────────
      if (ri >= 2 && ri < de && ri % 2 === 0) {
        data.cell.styles.fillColor = ALTROW
      }

      // ── Total rows ─────────────────────────────────────────
      if (ri === de || ri === de + 1) {
        data.cell.styles.fontStyle  = 'bold'
        data.cell.styles.halign     = 'center'
        data.cell.styles.valign     = 'middle'
        data.cell.styles.fillColor  = WHITE
        // Remove borders on cols 0,1 and col 7 (red box areas)
        if (data.column.index <= 1 || data.column.index === 7) {
          data.cell.styles.lineColor  = WHITE
          data.cell.styles.lineWidth  = 0
        }
        // Span col 2-3 for label
        if (data.column.index === 2) (data.cell as any).colSpan = 2
        // Span col 6 for count (only show on address col)
        if (data.column.index === 6) (data.cell as any).rowSpan = 2
      }
    },
    didDrawCell: (data) => {
      const ri = data.row.index
      // Box border around total block cols 2-6 only
      if (ri === de && data.column.index === 2) {
        const totalW = COL_W[2]+COL_W[3]+COL_W[4]+COL_W[5]+COL_W[6]
        const totalH = (data.cell.height) * 2
        doc.setDrawColor(...BLACK)
        doc.setLineWidth(0.6)
        doc.rect(data.cell.x, data.cell.y, totalW, totalH)
      }
    },
  })

  y = (doc as any).lastAutoTable.finalY

  // ── Footer (pinned to bottom using absolute Y) ───────────────
  const footerY = PH - MB - FOOTER_H

  // Signature block
  const sigY = footerY + 4
  doc.setFontSize(8); doc.setFont('helvetica','normal')

  // Left block labels
  doc.text('Signature of Jathedar', ML + SIG_A - SIG_A, sigY + 6)
  doc.text('Name',                  ML,                  sigY + 14)
  doc.text('Date',                  ML,                  sigY + 22)

  // Left underlines (span SIG_B = Name+Father cols width)
  doc.setDrawColor(...BLACK); doc.setLineWidth(0.4)
  doc.line(ML + SIG_A + 2,         sigY + 7,  ML + SIG_A + SIG_B, sigY + 7)   // sig line
  doc.line(ML + SIG_A + 2,         sigY + 15, ML + SIG_A + SIG_B, sigY + 15)  // name line
  doc.line(ML + SIG_A + 2,         sigY + 23, ML + SIG_A + SIG_B, sigY + 23)  // date line

  // Name value
  doc.setFont('helvetica','bold')
  doc.text(jathName, ML + SIG_A + 3, sigY + 13)
  doc.setFont('helvetica','normal')

  // Right block — starts at SIG_A + SIG_B + SIG_C from ML
  const rX = ML + SIG_A + SIG_B + SIG_C
  const rW = SIG_E

  // Top line of right block (at Name row level)
  doc.line(rX, sigY + 8, rX + rW, sigY + 8)

  // Right block text centred
  doc.setFontSize(8)
  doc.text('Secretary / Area Secretary', rX + rW/2, sigY + 14, { align: 'center' })
  doc.text(`( Stamp )   Date : ${today()}`, rX + rW/2, sigY + 22, { align: 'center' })

  // === lines
  const eqY = footerY + 30
  doc.setFontSize(7); doc.setFont('courier','normal')
  const eqLine = '='.repeat(Math.floor(CW / (7 * 0.601)))
  doc.text(eqLine, ML, eqY, { charSpace: 0 })

  // Arrival / Departure
  const arrY = eqY + 4
  doc.setFontSize(8.5); doc.setFont('helvetica','bold')
  doc.text('Arrival Date & Time',   ML, arrY + 5)
  doc.text('Departure Date & Time', ML, arrY + 11)
  doc.setFont('helvetica','normal'); doc.setFontSize(8)
  doc.text(`: ${fmtDate(nr.from_date)} - 03:20 PM`, ML + CW*0.35, arrY + 5)
  doc.text(`: ${fmtDate(nr.to_date)}   - 03:20 PM`, ML + CW*0.35, arrY + 11)

  // Closing === line
  doc.setFontSize(7); doc.setFont('courier','normal')
  doc.text(eqLine, ML, arrY + 15)
}

export async function generateNRPDF(options: GeneratePDFOptions): Promise<void> {
  const { nr, sections, jathedar } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  renderSheet(doc, nr, sections, jathedar, 'M', 'MALE',   true)
  renderSheet(doc, nr, sections, jathedar, 'F', 'FEMALE', false)

  const filename = `${(nr.jatha_name ?? 'NR').replace(/[^a-zA-Z0-9_\- ]/g,'').replace(/\s+/g,'_')}_NR.pdf`
  doc.save(filename)
}
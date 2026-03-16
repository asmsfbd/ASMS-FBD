/**
 * NR PDF — Official RSSB Faridabad Format
 * Pure browser-native: jsPDF + jspdf-autotable
 * Changes:
 *  - Sangat members print masked aadhaar (XXXX-XXXX-LAST4) instead of sangat_id
 *  - Removed hardcoded 'BEAS' destination fallback
 *  - Removed hardcoded 03:20 PM arrival/departure times
 *  - Logo loaded at runtime from /logo.png (put logo file in /public/logo.png)
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
  member_type: 'sewadar' | 'sangat'
  aadhaar_masked: string | null
}
export interface GeneratePDFOptions {
  nr: NRForPDF; sections: SectionForPDF[]; jathedar: MemberForPDF | null
}

const BLK: [number,number,number] = [0,0,0]
const GRY: [number,number,number] = [200,200,200]
const WHT: [number,number,number] = [255,255,255]
const ALT: [number,number,number] = [247,247,247]

function fd(d: string|null): string {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`
  } catch { return d }
}
function days(f:string|null, t:string|null): string {
  if (!f||!t) return '1'
  return String(Math.round((new Date(t).getTime()-new Date(f).getTime())/86400000)+1)
}
function td(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

// Load logo as base64 from /public/logo.png at runtime
async function loadLogo(): Promise<string|null> {
  try {
    const res = await fetch('/logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const PW=210, PH=297, ML=12, MR=12, MT=10, MB=10
const CW=PW-ML-MR
const LW=16, LH=LW*(177/148)
const C0=7, C1=22, C2=22, C3=20, C4=7, C5=7
const C6a=Math.round((CW-C0-C1-C2-C3-C4-C5)*0.60)
const C7=CW-C0-C1-C2-C3-C4-C5-C6a
const COLS=[C0,C1,C2,C3,C4,C5,C6a,C7]
const HL1=28, HC1=4, HV1=CW/2-HL1-HC1
const HL2=32, HC2=4, HV2=CW/2-HL2-HC2
const SA=C0+C1, SB=C2+C3, SC=C4+C5+C6a*0.6, SE=C6a*0.4+C7

function sheet(
  doc: jsPDF,
  nr: NRForPDF,
  sections: SectionForPDF[],
  jathedar: MemberForPDF|null,
  gf: 'M'|'F',
  lbl: 'MALE'|'FEMALE',
  first: boolean,
  logoB64: string|null
) {
  const secs = sections
    .map(s => ({ ...s, members: s.members.filter(m => m.gender.toUpperCase() === gf) }))
    .filter(s => s.members.length > 0)
  if (!secs.length) return

  if (!first) doc.addPage()

  const jath    = secs.flatMap(s => s.members).find(m => m.is_jathedar) ?? jathedar
  const place   = sections.map(s => s.centre).join(' | ').toUpperCase()
  const isT     = (nr.vehicle_type??'').toUpperCase() === 'TRAIN'
  const drvLbl  = isT ? 'Train Name & Time' : 'Name of Driver & Mobile No'
  const drvV    = nr.driver_name ? `${nr.driver_name}${nr.driver_mobile?' | '+nr.driver_mobile:''}` : ''
  const jathName = (jath?.name??'').toUpperCase()
  const jathMob  = jath?.mobile??''

  if (logoB64) doc.addImage(logoB64, 'PNG', ML, MT, LW, LH)

  doc.setFontSize(7); doc.setFont('helvetica','normal')
  doc.setTextColor(80,80,80)
  doc.text('SCI/2020/84', PW-MR, MT+3, { align: 'right' })
  doc.setTextColor(0,0,0)

  let y = MT+4
  doc.setFontSize(11); doc.setFont('helvetica','bold')
  doc.text('SATSANG CENTRES IN INDIA', PW/2, y+5, { align: 'center' }); y += 7
  doc.setFontSize(9)
  doc.text(`NOMINAL ROLL OF JATHA ${lbl}`, PW/2, y+4, { align: 'center' }); y += 6
  if (y < MT+LH+2) y = MT+LH+2

  autoTable(doc, {
    startY: y,
    body: [
      ['Name of Satsang Place', ':', place,      'Area : FARIDABAD', ':', 'ZONE: III'],
      ['Name of Jathedar',      ':', jathName,    drvLbl,             ':', drvV],
      ['Mobile No',             ':', jathMob,     'Type of Vehicle / Vehicle No', ':', nr.vehicle_type??''],
      ['Place of Sewa',         ':', nr.destination??'', 'Department',':', (nr.department??'').toUpperCase()],
    ],
    columnStyles: {
      0:{cellWidth:HL1,fontStyle:'normal'}, 1:{cellWidth:HC1,halign:'center'},
      2:{cellWidth:HV1,fontStyle:'bold'},   3:{cellWidth:HL2,fontStyle:'normal'},
      4:{cellWidth:HC2,halign:'center'},    5:{cellWidth:HV2,fontStyle:'bold'},
    },
    theme:'plain',
    styles:{fontSize:8,cellPadding:{top:2.5,bottom:2.5,left:3,right:2},valign:'bottom',overflow:'linebreak'},
    margin:{left:ML,right:MR}, tableWidth:CW,
    didDrawCell:(d) => {
      if (d.section==='body' && (d.column.index===2||d.column.index===5)) {
        doc.setDrawColor(...GRY); doc.setLineWidth(0.3)
        doc.line(d.cell.x, d.cell.y+d.cell.height, d.cell.x+d.cell.width, d.cell.y+d.cell.height)
      }
    },
  })
  y = (doc as any).lastAutoTable.finalY + 2

  // Build member rows — sangat members show masked aadhaar
  const allM = secs.flatMap(s => s.members.map(m => ({ ...m, _ctr: s.centre, _srs: s.srs_id??'—' })))
  const mc   = allM.filter(m => m.gender.toUpperCase()==='M').length
  const fc   = allM.filter(m => m.gender.toUpperCase()==='F').length
  const tot  = nr.member_count ?? (mc+fc)
  const d5   = days(nr.from_date, nr.to_date)

  const dataRows = allM.map((m, i) => {
    let age = '—'
    try { if (m.age != null) age = String(Math.floor(Number(m.age))) } catch {}
    const addr = (m.address??'—') + (m.mobile ? '\n'+m.mobile : '')
    // Sangat: show masked aadhaar; Sewadar: show badge number
    const idDisplay = m.member_type === 'sangat' && m.aadhaar_masked ? m.aadhaar_masked : m.display_id
    return [String(i+1), idDisplay, m.name, m.father_name??'—', m.gender, age, addr, `${m._ctr}\n${m._srs}`]
  })

  const de = 2 + dataRows.length

  const body: any[] = [
    [`Sewa duration (No_Of_Days)   ${d5} Days`,'','', `Date ( From ) :  ${fd(nr.from_date)}`,'','', `Date ( To ) :  ${fd(nr.to_date)}`,''],
    ['Sno','Badge No./\nAadhar No.',"Sewadar's\nName","Father's\nName",'M/F','Age','Address &\nPhone No.','Centre /\nSRS ID'],
    ...dataRows,
    ['','','TOTAL SEWADARS','','M','F',String(tot),''],
    ['','','','', gf==='M'?String(mc):'', String(fc),'',''],
  ]

  autoTable(doc, {
    startY: y, body,
    columnStyles:{
      0:{cellWidth:COLS[0],halign:'center'}, 1:{cellWidth:COLS[1]}, 2:{cellWidth:COLS[2]},
      3:{cellWidth:COLS[3]}, 4:{cellWidth:COLS[4],halign:'center'}, 5:{cellWidth:COLS[5],halign:'center'},
      6:{cellWidth:COLS[6]}, 7:{cellWidth:COLS[7],halign:'center'},
    },
    theme:'grid',
    styles:{fontSize:7.5,cellPadding:{top:1.5,bottom:1.5,left:1.5,right:1.5},lineColor:GRY,lineWidth:0.3,textColor:BLK,valign:'top',overflow:'linebreak'},
    margin:{left:ML,right:MR}, tableWidth:CW,
    didParseCell:(data) => {
      const ri=data.row.index, ci=data.column.index
      if (ri===0) {
        data.cell.styles.fontStyle='bold'; data.cell.styles.valign='middle'
        data.cell.styles.fillColor=WHT; data.cell.styles.fontSize=7.5
        if (ci===0) (data.cell as any).colSpan=3
        else if (ci===3) (data.cell as any).colSpan=3
        else if (ci===6) (data.cell as any).colSpan=2
      }
      if (ri===1) {
        data.cell.styles.fontStyle='bold'; data.cell.styles.halign='center'
        data.cell.styles.valign='middle'; data.cell.styles.fillColor=WHT; data.cell.styles.fontSize=7
      }
      if (ri>=2&&ri<de&&ri%2===0) data.cell.styles.fillColor=ALT
      if (ri===de||ri===de+1) {
        data.cell.styles.fontStyle='bold'; data.cell.styles.halign='center'
        data.cell.styles.valign='middle'; data.cell.styles.fillColor=WHT
        if (ci<=1||ci===7) { data.cell.styles.lineColor=WHT; data.cell.styles.lineWidth=0 }
        if (ci===2) (data.cell as any).colSpan=2
        if (ci===6&&ri===de) (data.cell as any).rowSpan=2
      }
    },
    didDrawCell:(data) => {
      if (data.row.index===de&&data.column.index===2) {
        const bw=COLS[2]+COLS[3]+COLS[4]+COLS[5]+COLS[6], bh=data.cell.height*2
        doc.setDrawColor(...BLK); doc.setLineWidth(0.6)
        doc.rect(data.cell.x, data.cell.y, bw, bh)
      }
    },
  })

  // Footer
  const fY = PH - MB - 48
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
  const lx=ML, ux=ML+SA+1, ue=ML+SA+SB

  doc.text('Signature of Jathedar', lx, fY+6)
  doc.text('Name', lx, fY+13)
  doc.text('Date', lx, fY+20)

  doc.setDrawColor(...BLK); doc.setLineWidth(0.4)
  doc.line(ux, fY+7, ue, fY+7)
  doc.line(ux, fY+14, ue, fY+14)
  doc.line(ux, fY+21, ue, fY+21)

  doc.setFont('helvetica','bold')
  doc.text(jathName, ux+1, fY+13)
  doc.setFont('helvetica','normal')

  const rx=ML+SA+SB+SC, rw=SE
  doc.line(rx, fY+8, rx+rw, fY+8)
  doc.setFontSize(8)
  doc.text('Secretary / Area Secretary', rx+rw/2, fY+14, { align: 'center' })
  doc.text(`( Stamp )   Date : ${td()}`, rx+rw/2, fY+20, { align: 'center' })

  const eq1Y = fY+26
  doc.setDrawColor(...GRY); doc.setLineWidth(0.5)
  doc.line(ML, eq1Y, ML+CW, eq1Y)
  doc.setFontSize(6.5); doc.setFont('courier','normal'); doc.setTextColor(100,100,100)
  doc.text('='.repeat(130), ML, eq1Y+0.5, { charSpace: 0 })
  doc.setTextColor(0,0,0)

  // Arrival / Departure — dates only, no hardcoded time
  const aY = eq1Y+4
  doc.setFontSize(8.5); doc.setFont('helvetica','bold')
  doc.text('Arrival Date', ML, aY+5)
  doc.text('Departure Date', ML, aY+11)
  doc.setFont('helvetica','normal'); doc.setFontSize(8)
  doc.text(`: ${fd(nr.from_date)}`, ML+CW*0.35, aY+5)
  doc.text(`: ${fd(nr.to_date)}`, ML+CW*0.35, aY+11)

  const eq2Y = aY+15
  doc.setFontSize(6.5); doc.setFont('courier','normal'); doc.setTextColor(100,100,100)
  doc.text('='.repeat(130), ML, eq2Y, { charSpace: 0 })
  doc.setTextColor(0,0,0)
}

export async function generateNRPDF(opts: GeneratePDFOptions): Promise<void> {
  const { nr, sections, jathedar } = opts
  const logoB64 = await loadLogo()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  sheet(doc, nr, sections, jathedar, 'M', 'MALE',   true,  logoB64)
  sheet(doc, nr, sections, jathedar, 'F', 'FEMALE', false, logoB64)
  const fn = `${(nr.jatha_name??'NR').replace(/[^a-zA-Z0-9_\- ]/g,'').replace(/\s+/g,'_')}_NR.pdf`
  doc.save(fn)
}
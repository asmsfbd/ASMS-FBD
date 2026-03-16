import * as XLSX from 'xlsx'

export interface NRForExcel {
  id: number
  centre: string
  jatha_name: string | null
  destination: string | null
  department: string | null
  from_date: string | null
  to_date: string | null
  jathedar_name: string | null
  jathedar_phone: string | null
  vehicle_type: string | null
  driver_name: string | null
  driver_mobile: string | null
  member_count: number
  male_count: number
  female_count: number
}

export interface MemberForExcel {
  serial_no: number
  display_id: string
  name: string
  father_name: string | null
  gender: string
  age: number | null
  address: string | null
  mobile: string | null
  is_jathedar: boolean
  contributing_centre: string
  member_type: 'sewadar' | 'sangat'
  aadhaar_masked: string | null
}

export interface SectionForExcel {
  centre: string
  srs_id: string | null
  members: MemberForExcel[]
}

export interface GenerateExcelOptions {
  nr: NRForExcel
  sections: SectionForExcel[]
}

function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-IN', { month: 'short' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

function formatDateForExcel(dateStr: string | null): any {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d
}

function calculateDays(fromDate: string | null, toDate: string | null): number {
  if (!fromDate || !toDate) return 1
  return Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1
}

function getTodayDate(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-IN', { month: 'short' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

async function loadWorkbook(): Promise<XLSX.WorkBook> {
  const response = await fetch('/NominalRole_Format.xlsx')
  const arrayBuffer = await response.arrayBuffer()
  return XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellStyles: true, cellFormula: true, cellHTML: true })
}

function populateSheet(
  ws: XLSX.WorkSheet,
  nr: NRForExcel,
  members: (MemberForExcel & { srs_id: string | null })[]
) {
  ws['C7'] = { t: 's', v: nr.centre }
  ws['C8'] = { t: 's', v: nr.jathedar_name || '' }
  ws['C9'] = { t: 's', v: nr.jathedar_phone || '' }
  ws['C10'] = { t: 's', v: nr.destination || '' }
  ws['F10'] = { t: 's', v: nr.department || '' }
  
  const driverMobile = nr.driver_name && nr.driver_mobile 
    ? `${nr.driver_name} | ${nr.driver_mobile}` 
    : (nr.driver_name || '')
  ws['H8'] = { t: 's', v: driverMobile }
  ws['H9'] = { t: 's', v: nr.vehicle_type || '' }

  const days = calculateDays(nr.from_date, nr.to_date)
  ws['D12'] = { t: 'n', v: days }
  ws['F12'] = { t: 'd', v: formatDateForExcel(nr.from_date) }
  ws['H12'] = { t: 'd', v: formatDateForExcel(nr.to_date) }

  const dataStartRow = 14
  
  members.forEach((m, idx) => {
    const row = dataStartRow + idx
    const idDisplay = m.member_type === 'sangat' && m.aadhaar_masked ? m.aadhaar_masked : m.display_id
    const addressPhone = [m.address, m.mobile].filter(Boolean).join('\n')
    const centreSrs = m.srs_id ? `${m.contributing_centre}\nSRS: ${m.srs_id}` : m.contributing_centre

    const colA = `A${row}`
    const colB = `B${row}`
    const colC = `C${row}`
    const colD = `D${row}`
    const colE = `E${row}`
    const colF = `F${row}`
    const colG = `G${row}`
    const colH = `H${row}`

    ws[colA] = { t: 'n', v: idx + 1 }
    ws[colB] = { t: 's', v: idDisplay }
    ws[colC] = { t: 's', v: m.name }
    ws[colD] = { t: 's', v: m.father_name || '' }
    ws[colE] = { t: 's', v: m.gender }
    ws[colF] = { t: 'n', v: m.age || 0 }
    ws[colG] = { t: 's', v: addressPhone }
    ws[colH] = { t: 's', v: centreSrs }
  })

  const maleCount = members.filter(m => m.gender.toUpperCase() === 'M').length
  const femaleCount = members.filter(m => m.gender.toUpperCase() === 'F').length
  const totalCount = maleCount + femaleCount

  ws['E16'] = { t: 'n', v: maleCount }
  ws['F16'] = { t: 'n', v: femaleCount }
  ws['G15'] = { t: 'n', v: totalCount }

  const todayDate = getTodayDate()
  ws['H26'] = { t: 's', v: `( Stamp ) Date : ${todayDate}` }

  ws['E31'] = { t: 's', v: `: ${formatDateDisplay(nr.from_date)}` }
  ws['E32'] = { t: 's', v: `: ${formatDateDisplay(nr.to_date)}` }
}

export async function generateNRExcel(opts: GenerateExcelOptions): Promise<void> {
  const { nr, sections } = opts

  const wb = await loadWorkbook()

  const maleWs = wb.Sheets['Male']
  const femaleWs = wb.Sheets['Female']

  const genderFilter = 'M'
  const maleMembers: (MemberForExcel & { srs_id: string | null })[] = []
  sections.forEach(section => {
    section.members
      .filter(m => m.gender.toUpperCase() === genderFilter)
      .forEach(m => {
        maleMembers.push({ ...m, srs_id: section.srs_id })
      })
  })

  const femaleMembers: (MemberForExcel & { srs_id: string | null })[] = []
  sections.forEach(section => {
    section.members
      .filter(m => m.gender.toUpperCase() === 'F')
      .forEach(m => {
        femaleMembers.push({ ...m, srs_id: section.srs_id })
      })
  })

  populateSheet(maleWs, nr, maleMembers)
  populateSheet(femaleWs, nr, femaleMembers)

  const fileName = `${(nr.jatha_name ?? 'NR').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')}_NR.xlsx`
  XLSX.writeFile(wb, fileName)
}

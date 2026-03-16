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

function setCellValue(ws: XLSX.WorkSheet, cellRef: string, value: string | number) {
  const existingCell = ws[cellRef]
  if (existingCell) {
    existingCell.v = value
    if (typeof value === 'number') {
      existingCell.t = 'n'
    } else {
      existingCell.t = 's'
    }
  } else {
    ws[cellRef] = {
      t: typeof value === 'number' ? 'n' : 's',
      v: value
    }
  }
}

async function loadWorkbook(): Promise<XLSX.WorkBook> {
  const response = await fetch('/NominalRole_Format.xlsx')
  const arrayBuffer = await response.arrayBuffer()
  return XLSX.read(new Uint8Array(arrayBuffer), { 
    type: 'array', 
    cellStyles: true, 
    cellFormula: true, 
    cellHTML: true,
    sheetStubs: true
  })
}

function populateSheet(
  ws: XLSX.WorkSheet,
  nr: NRForExcel,
  members: (MemberForExcel & { srs_id: string | null })[]
) {
  setCellValue(ws, 'C7', nr.centre)
  setCellValue(ws, 'C8', nr.jathedar_name || '')
  setCellValue(ws, 'C9', nr.jathedar_phone || '')
  setCellValue(ws, 'C10', nr.destination || '')
  setCellValue(ws, 'F10', nr.department || '')
  
  const driverMobile = nr.driver_name && nr.driver_mobile 
    ? `${nr.driver_name} | ${nr.driver_mobile}` 
    : (nr.driver_name || '')
  setCellValue(ws, 'H8', driverMobile)
  setCellValue(ws, 'H9', nr.vehicle_type || '')

  const days = calculateDays(nr.from_date, nr.to_date)
  setCellValue(ws, 'D12', days)
  setCellValue(ws, 'F12', formatDateDisplay(nr.from_date))
  setCellValue(ws, 'H12', formatDateDisplay(nr.to_date))

  const dataStartRow = 14
  
  members.forEach((m, idx) => {
    const row = dataStartRow + idx
    const idDisplay = m.member_type === 'sangat' && m.aadhaar_masked ? m.aadhaar_masked : m.display_id
    const addressPhone = [m.address, m.mobile].filter(Boolean).join('\n')
    const centreSrs = m.srs_id ? `${m.contributing_centre}\nSRS: ${m.srs_id}` : m.contributing_centre

    setCellValue(ws, `A${row}`, idx + 1)
    setCellValue(ws, `B${row}`, idDisplay)
    setCellValue(ws, `C${row}`, m.name)
    setCellValue(ws, `D${row}`, m.father_name || '')
    setCellValue(ws, `E${row}`, m.gender)
    setCellValue(ws, `F${row}`, m.age ?? 0)
    setCellValue(ws, `G${row}`, addressPhone)
    setCellValue(ws, `H${row}`, centreSrs)
  })

  const maleCount = members.filter(m => m.gender.toUpperCase() === 'M').length
  const femaleCount = members.filter(m => m.gender.toUpperCase() === 'F').length
  const totalCount = maleCount + femaleCount

  setCellValue(ws, 'E16', maleCount)
  setCellValue(ws, 'F16', femaleCount)
  setCellValue(ws, 'G15', totalCount)

  const todayDate = getTodayDate()
  setCellValue(ws, 'H26', `( Stamp ) Date : ${todayDate}`)

  setCellValue(ws, 'E31', `: ${formatDateDisplay(nr.from_date)}`)
  setCellValue(ws, 'E32', `: ${formatDateDisplay(nr.to_date)}`)
}

export async function generateNRExcel(opts: GenerateExcelOptions): Promise<void> {
  const { nr, sections } = opts

  const wb = await loadWorkbook()

  const maleWs = wb.Sheets['Male']
  const femaleWs = wb.Sheets['Female']

  const maleMembers: (MemberForExcel & { srs_id: string | null })[] = []
  sections.forEach(section => {
    section.members
      .filter(m => m.gender.toUpperCase() === 'M')
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

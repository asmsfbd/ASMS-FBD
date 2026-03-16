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

function formatDate(dateStr: string | null): string {
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

function createSheet(
  sheetName: 'Male' | 'Female',
  nr: NRForExcel,
  sections: SectionForExcel[]
): XLSX.WorkSheet {
  const genderFilter = sheetName === 'Male' ? 'M' : 'F'
  
  const allMembers: (MemberForExcel & { srs_id: string | null })[] = []
  
  sections.forEach(section => {
    section.members
      .filter(m => m.gender.toUpperCase() === genderFilter)
      .forEach(m => {
        allMembers.push({ ...m, srs_id: section.srs_id })
      })
  })

  const totalCount = allMembers.length
  const days = calculateDays(nr.from_date, nr.to_date)
  const todayDate = getTodayDate()

  const ws: any = {}

  ws['!ref'] = 'A1:H32'
  ws['!merges'] = [
    { s: { r: 0, c: 7 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 4 } },
    { s: { r: 6, c: 5 }, e: { r: 6, c: 6 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },
    { s: { r: 7, c: 4 }, e: { r: 7, c: 5 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },
    { s: { r: 8, c: 4 }, e: { r: 8, c: 5 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },
    { s: { r: 9, c: 4 }, e: { r: 9, c: 5 } },
    { s: { r: 11, c: 0 }, e: { r: 11, c: 2 } },
    { s: { r: 11, c: 3 }, e: { r: 11, c: 3 } },
    { s: { r: 11, c: 5 }, e: { r: 11, c: 6 } },
    { s: { r: 11, c: 7 }, e: { r: 11, c: 7 } },
    { s: { r: 12, c: 0 }, e: { r: 12, c: 0 } },
    { s: { r: 12, c: 1 }, e: { r: 12, c: 1 } },
    { s: { r: 12, c: 2 }, e: { r: 12, c: 2 } },
    { s: { r: 12, c: 3 }, e: { r: 12, c: 3 } },
    { s: { r: 12, c: 4 }, e: { r: 12, c: 4 } },
    { s: { r: 12, c: 5 }, e: { r: 12, c: 5 } },
    { s: { r: 12, c: 6 }, e: { r: 12, c: 6 } },
    { s: { r: 12, c: 7 }, e: { r: 12, c: 7 } },
    { s: { r: 23, c: 0 }, e: { r: 23, c: 1 } },
    { s: { r: 23, c: 4 }, e: { r: 23, c: 4 } },
    { s: { r: 23, c: 7 }, e: { r: 23, c: 7 } },
    { s: { r: 24, c: 1 }, e: { r: 24, c: 2 } },
    { s: { r: 24, c: 7 }, e: { r: 24, c: 7 } },
    { s: { r: 25, c: 1 }, e: { r: 25, c: 2 } },
    { s: { r: 25, c: 7 }, e: { r: 25, c: 7 } },
    { s: { r: 26, c: 1 }, e: { r: 26, c: 2 } },
    { s: { r: 26, c: 7 }, e: { r: 26, c: 7 } },
    { s: { r: 30, c: 0 }, e: { r: 30, c: 2 } },
    { s: { r: 30, c: 3 }, e: { r: 30, c: 7 } },
    { s: { r: 31, c: 0 }, e: { r: 31, c: 2 } },
    { s: { r: 31, c: 3 }, e: { r: 31, c: 7 } },
  ]

  const centerAlign = { alignment: { horizontal: 'center' } }
  const leftAlign = { alignment: { horizontal: 'left' } }
  const bold = { font: { bold: true } }
  const boldCenter = { ...bold, ...centerAlign }
  const borderThin = {
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
  const borderMedium = {
    border: {
      top: { style: 'medium' },
      bottom: { style: 'medium' },
      left: { style: 'medium' },
      right: { style: 'medium' }
    }
  }

  const setCell = (row: number, col: number, value: any, style?: any) => {
    const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })
    ws[cellRef] = { v: value, ...style }
  }

  setCell(1, 8, 'SCI/2020/84', { alignment: { horizontal: 'right' } })
  setCell(2, 1, 'SATSANG CENTRES IN INDIA', { font: { bold: true, size: 14 }, alignment: { horizontal: 'center' } })
  setCell(3, 1, `NOMINAL ROLL OF JATHA ${sheetName.toUpperCase()}`, { font: { bold: true, size: 12 }, alignment: { horizontal: 'center' } })

  setCell(7, 1, 'Name of Satsang Place', { ...bold })
  setCell(7, 2, ':')
  setCell(7, 3, nr.centre, { ...bold })
  setCell(7, 6, 'Area : FARIDABAD')
  setCell(7, 8, 'ZONE: III')

  setCell(8, 1, 'Name of Jathedar', { ...bold })
  setCell(8, 2, ':')
  setCell(8, 3, nr.jathedar_name || '', { ...bold })
  setCell(8, 6, 'Name of Driver & Mobile No')
  setCell(8, 7, ':')
  setCell(8, 8, nr.driver_name && nr.driver_mobile ? `${nr.driver_name} | ${nr.driver_mobile}` : (nr.driver_name || ''))

  setCell(9, 1, 'Mobile No', { ...bold })
  setCell(9, 2, ':')
  setCell(9, 3, nr.jathedar_phone || '')
  setCell(9, 6, 'Type of Vehicle / Vehicle No')
  setCell(9, 7, ':')
  setCell(9, 8, nr.vehicle_type || '')

  setCell(10, 1, 'Place of Sewa', { ...bold })
  setCell(10, 2, ':')
  setCell(10, 3, nr.destination || '', { ...bold })
  setCell(10, 6, 'Department')
  setCell(10, 7, ':')
  setCell(10, 8, nr.department || '')

  setCell(12, 1, 'Sewa duration (No_Of_Days)', { ...bold })
  setCell(12, 4, days, { ...boldCenter })
  setCell(12, 6, formatDate(nr.from_date), { ...bold })
  setCell(12, 8, formatDate(nr.to_date), { ...bold })

  setCell(13, 1, 'Sno', { ...boldCenter, ...borderThin })
  setCell(13, 2, 'Badge Number / Aadhaar Number', { ...boldCenter, ...borderThin })
  setCell(13, 3, 'Name Of Sewadar', { ...boldCenter, ...borderThin })
  setCell(13, 4, "Father's Name", { ...boldCenter, ...borderThin })
  setCell(13, 5, 'M / F', { ...boldCenter, ...borderThin })
  setCell(13, 6, 'Age', { ...boldCenter, ...borderThin })
  setCell(13, 7, 'Address & Phone No', { ...boldCenter, ...borderThin })
  setCell(13, 8, 'Centre / SRS Id', { ...boldCenter, ...borderThin })

  let rowIdx = 14
  allMembers.forEach((m, idx) => {
    const idDisplay = m.member_type === 'sangat' && m.aadhaar_masked ? m.aadhaar_masked : m.display_id
    const addressPhone = [m.address, m.mobile].filter(Boolean).join('\n')
    const centreSrs = m.srs_id ? `${m.contributing_centre}\n${m.srs_id}` : m.contributing_centre

    setCell(rowIdx, 1, idx + 1, { ...centerAlign, ...borderThin })
    setCell(rowIdx, 2, idDisplay, { ...borderThin })
    setCell(rowIdx, 3, m.name, { ...borderThin })
    setCell(rowIdx, 4, m.father_name || '', { ...borderThin })
    setCell(rowIdx, 5, m.gender, { ...centerAlign, ...borderThin })
    setCell(rowIdx, 6, m.age || '', { ...centerAlign, ...borderThin })
    setCell(rowIdx, 7, addressPhone, { ...borderThin })
    setCell(rowIdx, 8, centreSrs, { ...borderThin })
    rowIdx++
  })

  const totalRow = 14 + Math.max(allMembers.length, 1)
  setCell(totalRow, 3, 'TOTAL SEWADARS', { ...boldCenter })
  setCell(totalRow, 5, 'M', { ...boldCenter })
  setCell(totalRow, 6, 'F', { ...boldCenter })

  const countRow = totalRow + 1
  setCell(countRow, 2, '', { ...borderMedium })
  setCell(countRow, 3, '', { ...borderMedium })
  setCell(countRow, 4, '', { ...borderMedium })
  setCell(countRow, 5, sheetName === 'Male' ? totalCount : '', { ...boldCenter, ...borderMedium })
  setCell(countRow, 6, sheetName === 'Female' ? totalCount : '', { ...boldCenter, ...borderMedium })
  setCell(countRow, 7, '', { ...borderMedium })
  setCell(countRow, 8, '', { ...borderMedium })

  setCell(24, 2, 'Signature of Jathedar', { ...bold })
  setCell(25, 2, 'Name', { ...bold })
  setCell(25, 8, 'Secretary / Area Secretary', { ...boldCenter })
  setCell(26, 2, 'Date', { ...bold })
  setCell(26, 8, `( Stamp ) Date : ${todayDate}`, { ...centerAlign })

  setCell(31, 1, 'Arrival Date & Time', { ...bold })
  setCell(31, 4, `: ${formatDate(nr.from_date)}`, { ...bold })
  setCell(32, 1, 'Departure Date & Time', { ...bold })
  setCell(32, 4, `: ${formatDate(nr.to_date)}`, { ...bold })

  const colWidths = [
    { wch: 8 },
    { wch: 20 },
    { wch: 25 },
    { wch: 20 },
    { wch: 8 },
    { wch: 8 },
    { wch: 25 },
    { wch: 20 },
  ]
  ws['!cols'] = colWidths

  return ws
}

export async function generateNRExcel(opts: GenerateExcelOptions): Promise<void> {
  const { nr, sections } = opts

  const wb = XLSX.utils.book_new()

  const maleSheet = createSheet('Male', nr, sections)
  const femaleSheet = createSheet('Female', nr, sections)

  XLSX.utils.book_append_sheet(wb, maleSheet, 'Male')
  XLSX.utils.book_append_sheet(wb, femaleSheet, 'Female')

  const fileName = `${(nr.jatha_name ?? 'NR').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')}_NR.xlsx`
  XLSX.writeFile(wb, fileName)
}

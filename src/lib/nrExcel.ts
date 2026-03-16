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

function formatDateForExcel(dateStr: string | null): number {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  const excelEpoch = new Date(1899, 11, 30)
  const days = Math.floor((d.getTime() - excelEpoch.getTime()) / (24 * 60 * 60 * 1000))
  return days
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

async function loadTemplate(sheetName: 'Male' | 'Female'): Promise<XLSX.WorkSheet> {
  const response = await fetch('/NominalRole_Format.xlsx')
  const arrayBuffer = await response.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  return wb.Sheets[sheetName]
}

function setCell(ws: XLSX.WorkSheet, row: number, col: number, value: any) {
  const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })
  if (typeof value === 'number') {
    ws[cellRef] = { t: 'n', v: value }
  } else if (typeof value === 'string') {
    ws[cellRef] = { t: 's', v: value }
  } else if (value !== null && value !== undefined) {
    ws[cellRef] = { t: 's', v: String(value) }
  } else {
    ws[cellRef] = { t: 's', v: '' }
  }
}

function shiftCellDown(ws: XLSX.WorkSheet, fromRow: number, toRow: number, col: number) {
  if (fromRow === toRow) return
  
  const steps = toRow > fromRow ? 1 : -1
  for (let r = toRow; r !== fromRow; r -= steps) {
    const srcRef = XLSX.utils.encode_cell({ r: r - steps - 1, c: col - 1 })
    const destRef = XLSX.utils.encode_cell({ r: r - 1, c: col - 1 })
    if (ws[srcRef]) {
      ws[destRef] = { ...ws[srcRef] }
    }
  }
}

function shiftRowsDown(ws: XLSX.WorkSheet, startRow: number, count: number) {
  const maxRow = 50
  
  for (let r = maxRow; r >= startRow; r--) {
    for (let c = 1; c <= 8; c++) {
      const srcRef = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })
      const destRef = XLSX.utils.encode_cell({ r: r + count - 1, c: c - 1 })
      if (ws[srcRef]) {
        ws[destRef] = { ...ws[srcRef] }
      }
    }
  }

  for (let r = startRow; r < startRow + count; r++) {
    for (let c = 1; c <= 8; c++) {
      const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })
      delete ws[ref]
    }
  }

  if (ws['!merges']) {
    const newMerges: XLSX.Range[] = []
    for (const merge of ws['!merges']) {
      if (merge.e.r >= startRow) {
        newMerges.push({
          s: { r: merge.s.r, c: merge.s.c },
          e: { r: merge.e.r + count, c: merge.e.c }
        })
      } else {
        newMerges.push(merge)
      }
    }
    ws['!merges'] = newMerges
  }

  const ref = XLSX.utils.decode_range(ws['!ref']!)
  ref.e.r += count
  ws['!ref'] = XLSX.utils.encode_range(ref.s, ref.e)
}

function populateSheet(
  ws: XLSX.WorkSheet,
  nr: NRForExcel,
  members: (MemberForExcel & { srs_id: string | null })[]
) {
  setCell(ws, 7, 3, nr.centre)
  setCell(ws, 8, 3, nr.jathedar_name || '')
  setCell(ws, 9, 3, nr.jathedar_phone || '')
  setCell(ws, 10, 3, nr.destination || '')
  setCell(ws, 10, 6, nr.department || '')
  
  const driverMobile = nr.driver_name && nr.driver_mobile 
    ? `${nr.driver_name} | ${nr.driver_mobile}` 
    : (nr.driver_name || '')
  setCell(ws, 8, 8, driverMobile)
  setCell(ws, 9, 8, nr.vehicle_type || '')

  const days = calculateDays(nr.from_date, nr.to_date)
  setCell(ws, 12, 4, days)
  setCell(ws, 12, 6, formatDateForExcel(nr.from_date))
  setCell(ws, 12, 8, formatDateForExcel(nr.to_date))

  const dataStartRow = 14
  
  members.forEach((m, idx) => {
    const row = dataStartRow + idx
    const idDisplay = m.member_type === 'sangat' && m.aadhaar_masked ? m.aadhaar_masked : m.display_id
    const addressPhone = [m.address, m.mobile].filter(Boolean).join('\n')
    const centreSrs = m.srs_id ? `${m.contributing_centre}\nSRS: ${m.srs_id}` : m.contributing_centre

    setCell(ws, row, 1, idx + 1)
    setCell(ws, row, 2, idDisplay)
    setCell(ws, row, 3, m.name)
    setCell(ws, row, 4, m.father_name || '')
    setCell(ws, row, 5, m.gender)
    setCell(ws, row, 6, m.age || '')
    setCell(ws, row, 7, addressPhone)
    setCell(ws, row, 8, centreSrs)
  })

  const maleCount = members.filter(m => m.gender.toUpperCase() === 'M').length
  const femaleCount = members.filter(m => m.gender.toUpperCase() === 'F').length
  const totalCount = maleCount + femaleCount

  setCell(ws, 16, 5, maleCount)
  setCell(ws, 16, 6, femaleCount)
  setCell(ws, 15, 7, totalCount)

  const todayDate = getTodayDate()
  setCell(ws, 26, 8, `( Stamp ) Date : ${todayDate}`)

  setCell(ws, 31, 5, `: ${formatDateDisplay(nr.from_date)}`)
  setCell(ws, 32, 5, `: ${formatDateDisplay(nr.to_date)}`)
}

async function processSheet(
  sheetName: 'Male' | 'Female',
  nr: NRForExcel,
  sections: SectionForExcel[]
): Promise<XLSX.WorkSheet> {
  const ws = await loadTemplate(sheetName)

  const genderFilter = sheetName === 'Male' ? 'M' : 'F'
  
  const allMembers: (MemberForExcel & { srs_id: string | null })[] = []
  
  sections.forEach(section => {
    section.members
      .filter(m => m.gender.toUpperCase() === genderFilter)
      .forEach(m => {
        allMembers.push({ ...m, srs_id: section.srs_id })
      })
  })

  const dataStartRow = 14
  const maxEmptyRows = 1
  
  if (allMembers.length > maxEmptyRows) {
    const rowsToInsert = allMembers.length - maxEmptyRows
    shiftRowsDown(ws, dataStartRow, rowsToInsert)
  }

  populateSheet(ws, nr, allMembers)

  return ws
}

export async function generateNRExcel(opts: GenerateExcelOptions): Promise<void> {
  const { nr, sections } = opts

  const wb = XLSX.utils.book_new()

  const [maleSheet, femaleSheet] = await Promise.all([
    processSheet('Male', nr, sections),
    processSheet('Female', nr, sections),
  ])

  XLSX.utils.book_append_sheet(wb, maleSheet, 'Male')
  XLSX.utils.book_append_sheet(wb, femaleSheet, 'Female')

  const fileName = `${(nr.jatha_name ?? 'NR').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')}_NR.xlsx`
  XLSX.writeFile(wb, fileName)
}

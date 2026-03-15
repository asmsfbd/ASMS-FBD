// NR PDF Generator — uses jsPDF + autoTable
// Install: npm install jspdf jspdf-autotable

interface NRForPDF {
  id:              number
  centre:          string
  status:          string
  srs_id:          string | null
  jatha_name:      string | null
  destination:     string | null
  department:      string | null
  from_date:       string | null
  to_date:         string | null
  jathedar_name:   string | null
  jathedar_phone:  string | null
  vehicle_type:    string | null
  driver_name?:    string | null
  driver_mobile?:  string | null
  male_count:      number
  female_count:    number
  member_count:    number
}

interface MemberForPDF {
  serial_no:   number
  display_id:  string
  name:        string
  father_name: string | null
  gender:      string
  age:         number | null
  address:     string | null
  mobile:      string | null
  department:  string | null
  is_jathedar: boolean
}

interface GeneratePDFOptions {
  nr:              NRForPDF
  members:         MemberForPDF[]
  centreName:      string
  isConsolidated?: boolean
  allCentreNRs?:   { nr: NRForPDF; members: MemberForPDF[] }[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export async function generateNRPDF(options: GeneratePDFOptions): Promise<void> {
  const { jsPDF }    = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { nr, members, centreName, isConsolidated, allCentreNRs } = options

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW  = 210
  const margin = 10
  const contentW = pageW - margin * 2

  // Helper: draw a single NR block
  const drawNR = (
    nrData: NRForPDF,
    memberData: MemberForPDF[],
    startY: number,
    centreLbl: string
  ): number => {
    let y = startY

    // ── LETTERHEAD ──────────────────────────────────────────────
    doc.setFillColor(107, 30, 46)  // maroon
    doc.rect(margin, y, contentW, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('RADHA SOAMI SATSANG BEAS', pageW / 2, y + 5, { align: 'center' })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Faridabad Area — Sewadar Nominal Role', pageW / 2, y + 9.5, { align: 'center' })
    y += 14

    // ── JATHA TITLE ─────────────────────────────────────────────
    doc.setFillColor(28, 53, 87)  // navy
    doc.rect(margin, y, contentW, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(nrData.jatha_name?.toUpperCase() ?? 'JATHA NOMINAL ROLE', pageW / 2, y + 5.5, { align: 'center' })
    y += 10

    // ── HEADER INFO TABLE ────────────────────────────────────────
    doc.setTextColor(0, 0, 0)
    const infoRows = [
      ['Centre', centreLbl || nrData.centre, 'SRS ID', nrData.srs_id ?? '—'],
      ['Destination', `${nrData.destination} · ${nrData.department}`, 'Total Members', `${nrData.member_count} (M:${nrData.male_count} F:${nrData.female_count})`],
      ['Dates', `${formatDateShort(nrData.from_date)} to ${formatDateShort(nrData.to_date)}`, 'Status', nrData.status.toUpperCase()],
    ]

    autoTable(doc, {
      startY: y,
      body: infoRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 30 },
        1: { cellWidth: 65 },
        2: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 30 },
        3: { cellWidth: 65 },
      },
      margin: { left: margin, right: margin },
      tableWidth: contentW,
    })
    y = (doc as any).lastAutoTable.finalY + 2

    // ── JATHEDAR BOX ─────────────────────────────────────────────
    if (nrData.jathedar_name) {
      doc.setFillColor(255, 248, 240)
      doc.setDrawColor(201, 146, 42)  // gold
      doc.rect(margin, y, contentW, 9, 'FD')
      doc.setTextColor(107, 30, 46)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('JATHEDAR:', margin + 3, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.text(nrData.jathedar_name, margin + 25, y + 5.5)
      if (nrData.jathedar_phone) {
        doc.text(`Ph: ${nrData.jathedar_phone}`, margin + 100, y + 5.5)
      }
      y += 11
    }

    // ── VEHICLE INFO ─────────────────────────────────────────────
    if (nrData.vehicle_type || nrData.driver_name) {
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      const vehicleStr = [
        nrData.vehicle_type && `Vehicle: ${nrData.vehicle_type}`,
        nrData.driver_name  && `Driver: ${nrData.driver_name}`,
        nrData.driver_mobile && `Mobile: ${nrData.driver_mobile}`,
      ].filter(Boolean).join('   |   ')
      doc.text(vehicleStr, margin, y + 4)
      y += 7
    }

    // ── MEMBER TABLE ─────────────────────────────────────────────
    // Sort: Jathedar first, then Males (A-Z), then Females (A-Z)
    const jathedarMembers = memberData.filter(m => m.is_jathedar)
    const maleMembers     = memberData.filter(m => !m.is_jathedar && m.gender === 'M').sort((a,b) => a.name.localeCompare(b.name))
    const femaleMembers   = memberData.filter(m => !m.is_jathedar && m.gender === 'F').sort((a,b) => a.name.localeCompare(b.name))
    const sorted          = [...jathedarMembers, ...maleMembers, ...femaleMembers]

    const tableBody = sorted.map((m, idx) => [
      String(idx + 1),
      m.display_id,
      m.name + (m.is_jathedar ? ' ★' : ''),
      m.father_name ?? '—',
      m.age ? String(m.age) : '—',
      m.gender === 'M' ? 'Male' : 'Female',
      m.address ?? '—',
      m.mobile ?? '—',
    ])

    autoTable(doc, {
      startY: y + 1,
      head: [['S.No', 'Badge/ID', 'Name', 'Father Name', 'Age', 'Gender', 'Address', 'Mobile']],
      body: tableBody,
      theme: 'striped',
      headStyles: {
        fillColor: [107, 30, 46],
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 9,  halign: 'center' },
        1: { cellWidth: 24, font: 'courier' },
        2: { cellWidth: 32, fontStyle: 'bold' },
        3: { cellWidth: 28 },
        4: { cellWidth: 8,  halign: 'center' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 48 },
        7: { cellWidth: 22 },
      },
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      alternateRowStyles: { fillColor: [252, 248, 248] },
      didParseCell: (data) => {
        // Highlight jathedar row
        if (data.row.index < jathedarMembers.length && data.section === 'body') {
          data.cell.styles.fillColor = [255, 243, 220]
          data.cell.styles.textColor = [107, 30, 46]
        }
      },
    })

    y = (doc as any).lastAutoTable.finalY + 4

    // ── SUMMARY ROW ──────────────────────────────────────────────
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(
      `Total: ${sorted.length}   |   Male: ${maleMembers.length + jathedarMembers.filter(m=>m.gender==='M').length}   |   Female: ${femaleMembers.length}`,
      margin, y
    )
    y += 8

    // ── SIGNATURE BLOCK ──────────────────────────────────────────
    const sigY = y + 4
    // Left: Centre Admin
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.line(margin, sigY + 10, margin + 55, sigY + 10)
    doc.text('Centre Admin Signature', margin, sigY + 14)
    doc.text(`Centre: ${centreLbl || nrData.centre}`, margin, sigY + 18)

    // Right: ASO
    doc.line(pageW - margin - 55, sigY + 10, pageW - margin, sigY + 10)
    doc.text('ASO / Area HQ Signature', pageW - margin - 55, sigY + 14)
    doc.text('Faridabad Area', pageW - margin - 55, sigY + 18)

    y = sigY + 22

    return y
  }

  // ── GENERATE PDF ─────────────────────────────────────────────
  if (isConsolidated && allCentreNRs && allCentreNRs.length > 0) {
    // Beas: all centres on separate pages
    allCentreNRs.forEach((item, idx) => {
      if (idx > 0) doc.addPage()
      drawNR(item.nr, item.members, 10, item.nr.centre)
    })
  } else {
    drawNR(nr, members, 10, centreName)
  }

  // Save
  const filename = isConsolidated
    ? `${nr.jatha_name ?? 'Jatha'}_Consolidated_NR.pdf`
    : `${nr.jatha_name ?? 'NR'}_${centreName}_NR.pdf`

  doc.save(filename.replace(/\s+/g, '_'))
}

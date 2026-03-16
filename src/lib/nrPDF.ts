// NR PDF Generator
// Columns: S.No | Name | Father Name | Age | Gender | Address | Mobile | SRS ID

interface NRForPDF {
  id:              number
  centre:          string
  jatha_name:      string | null
  destination:     string | null
  department:      string | null
  from_date:       string | null
  to_date:         string | null
  jathedar_name:   string | null
  jathedar_phone:  string | null
  vehicle_type:    string | null
  driver_name:     string | null
  driver_mobile:   string | null
  member_count:    number
  male_count:      number
  female_count:    number
}

interface SectionForPDF {
  centre:      string
  srs_id:      string | null
  is_ready:    boolean
  members:     MemberForPDF[]
}

interface MemberForPDF {
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
}

interface GeneratePDFOptions {
  nr:       NRForPDF
  sections: SectionForPDF[]  // each section = one centre's members with their SRS ID
  jathedar: MemberForPDF | null
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
}

function fmtShort(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short' })
}

export async function generateNRPDF(options: GeneratePDFOptions): Promise<void> {
  const { jsPDF }    = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const { nr, sections, jathedar } = options

  const doc      = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW    = 297
  const pageH    = 210
  const margin   = 8
  const contentW = pageW - margin * 2

  let y = margin

  // ── LETTERHEAD ──────────────────────────────────────────────
  doc.setFillColor(107, 30, 46)
  doc.rect(margin, y, contentW, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('RADHA SOAMI SATSANG BEAS', pageW / 2, y + 6, { align: 'center' })
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Faridabad Area — Sewadar Nominal Role', pageW / 2, y + 11, { align: 'center' })
  y += 16

  // ── JATHA TITLE ─────────────────────────────────────────────
  doc.setFillColor(28, 53, 87)
  doc.rect(margin, y, contentW, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text((nr.jatha_name ?? 'NOMINAL ROLE').toUpperCase(), pageW / 2, y + 6, { align: 'center' })
  y += 11

  // ── HEADER INFO ──────────────────────────────────────────────
  doc.setTextColor(0)
  const totalMale   = sections.reduce((s, sec) => s + sec.members.filter(m=>m.gender==='M').length, 0)
  const totalFemale = sections.reduce((s, sec) => s + sec.members.filter(m=>m.gender==='F').length, 0)
  const totalAll    = totalMale + totalFemale

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: 'Destination', styles: { fontStyle: 'bold', fillColor: [245,245,245], cellWidth: 28 } },
        `${nr.destination ?? '—'} · ${nr.department ?? '—'}`,
        { content: 'Dates', styles: { fontStyle: 'bold', fillColor: [245,245,245], cellWidth: 20 } },
        `${fmtShort(nr.from_date)} to ${fmtShort(nr.to_date)}`,
        { content: 'Total', styles: { fontStyle: 'bold', fillColor: [245,245,245], cellWidth: 18 } },
        `${totalAll} (M:${totalMale} F:${totalFemale})`,
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: margin, right: margin },
    tableWidth: contentW,
  })
  y = (doc as any).lastAutoTable.finalY + 2

  // ── JATHEDAR ─────────────────────────────────────────────────
  if (jathedar) {
    doc.setFillColor(255, 248, 220)
    doc.setDrawColor(201, 146, 42)
    doc.rect(margin, y, contentW, 8, 'FD')
    doc.setTextColor(107, 30, 46)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('★  JATHEDAR:', margin + 3, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(jathedar.name, margin + 28, y + 5)
    if (options.nr.jathedar_phone) {
      doc.text(`Ph: ${options.nr.jathedar_phone}`, margin + 100, y + 5)
    }
    // Find jathedar's SRS from their section
    const jatSRS = sections.find(s => s.centre === jathedar.contributing_centre)?.srs_id
    if (jatSRS) {
      doc.text(`SRS: ${jatSRS}`, margin + 150, y + 5)
    }
    y += 10
  }

  // ── VEHICLE ──────────────────────────────────────────────────
  if (nr.vehicle_type) {
    const isT = nr.vehicle_type === 'Train'
    doc.setTextColor(80)
    doc.setFontSize(7.5)
    const vStr = [
      `Vehicle: ${nr.vehicle_type}`,
      nr.driver_name   && `${isT ? 'Train Name' : 'Driver'}: ${nr.driver_name}`,
      nr.driver_mobile && `${isT ? 'Time' : 'Mobile'}: ${nr.driver_mobile}`,
    ].filter(Boolean).join('   |   ')
    doc.text(vStr, margin, y + 4)
    y += 7
  }

  // ── MEMBER TABLE — one section per centre ─────────────────────
  // Columns: S.No | Name | Father Name | Age | Gender | Address | Mobile | SRS ID

  for (const section of sections) {
    if (section.members.length === 0) continue

    // Section header
    const secMale   = section.members.filter(m=>m.gender==='M').length
    const secFemale = section.members.filter(m=>m.gender==='F').length

    // Sort: males A-Z then females A-Z within each section
    const sorted = [
      ...section.members.filter(m=>m.gender==='M').sort((a,b)=>a.name.localeCompare(b.name)),
      ...section.members.filter(m=>m.gender==='F').sort((a,b)=>a.name.localeCompare(b.name)),
    ]

    const tableBody = sorted.map((m, idx) => [
      String(idx + 1),
      m.name + (m.is_jathedar ? '  ★' : ''),
      m.father_name ?? '—',
      m.age ? String(m.age) : '—',
      m.gender === 'M' ? 'M' : 'F',
      m.address ?? '—',
      m.mobile ?? '—',
      section.srs_id ?? '—',        // SRS ID same for all rows in this section
    ])

    autoTable(doc, {
      startY: y + 1,
      head: [[
        { content: `${section.centre}  ${section.srs_id ? '· SRS: ' + section.srs_id : ''}  (M:${secMale} F:${secFemale})`, colSpan: 8 },
      ], [
        'S.No', 'Name', 'Father Name', 'Age', 'M/F', 'Address', 'Mobile', 'SRS ID',
      ]],
      body: tableBody,
      theme: 'striped',
      headStyles: [
        // Section title row
        { fillColor: [28, 53, 87], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        // Column headers row
        { fillColor: [107, 30, 46], textColor: 255, fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
      ],
      bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 40, fontStyle: 'bold' },
        2: { cellWidth: 35 },
        3: { cellWidth: 10, halign: 'center' },
        4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 60 },
        6: { cellWidth: 25 },
        7: { cellWidth: 20, halign: 'center', font: 'courier' },
      },
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      alternateRowStyles: { fillColor: [252, 248, 248] },
      didParseCell: (data) => {
        // Highlight jathedar row gold
        if (data.section === 'body') {
          const rowData = tableBody[data.row.index]
          if (rowData && rowData[1] && String(rowData[1]).includes('★')) {
            data.cell.styles.fillColor = [255, 243, 200]
            data.cell.styles.textColor = [107, 30, 46]
          }
        }
      },
      didDrawPage: () => {
        // Add page number at bottom
        const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 4, { align: 'right' })
        doc.text(`ASMS Faridabad · Generated ${new Date().toLocaleDateString('en-IN')}`, margin, pageH - 4)
      },
    })

    y = (doc as any).lastAutoTable.finalY + 3
  }

  // ── TOTALS ROW ───────────────────────────────────────────────
  doc.setFillColor(245, 245, 245)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setTextColor(0)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `Grand Total: ${totalAll} Sewadars   |   Male: ${totalMale}   |   Female: ${totalFemale}`,
    pageW / 2, y + 4.5, { align: 'center' }
  )
  y += 10

  // ── SIGNATURE BLOCKS ─────────────────────────────────────────
  // One signature block per section centre + ASO
  const sigBoxW   = Math.min(50, contentW / (sections.length + 1) - 3)
  let sigX        = margin

  for (const sec of sections) {
    if (y + 20 > pageH - margin) break
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.line(sigX, y + 12, sigX + sigBoxW, y + 12)
    doc.text('Signature', sigX, y + 15)
    doc.text(sec.centre, sigX, y + 18, { maxWidth: sigBoxW })
    sigX += sigBoxW + 4
  }

  // ASO signature
  if (sigX + sigBoxW <= pageW - margin) {
    doc.line(sigX, y + 12, sigX + sigBoxW, y + 12)
    doc.text('ASO / Area HQ Signature', sigX, y + 15)
    doc.text('Faridabad Area', sigX, y + 18)
  }

  // Save
  const filename = `${(nr.jatha_name ?? 'NR').replace(/\s+/g,'_')}_NR.pdf`
  doc.save(filename)
}

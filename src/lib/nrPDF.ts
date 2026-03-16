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
  centre:   string
  srs_id:   string | null
  is_ready: boolean
  members:  MemberForPDF[]
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
  sections: SectionForPDF[]
  jathedar: MemberForPDF | null
}

function fmtShort(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export async function generateNRPDF(options: GeneratePDFOptions): Promise<void> {
  const { jsPDF }                  = await import('jspdf')
  const { default: autoTable }     = await import('jspdf-autotable')
  const { nr, sections, jathedar } = options

  const doc      = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW    = 297
  const pageH    = 210
  const margin   = 8
  const contentW = pageW - margin * 2

  let y = margin

  // ── LETTERHEAD ───────────────────────────────────────────────
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

  // ── JATHA TITLE ──────────────────────────────────────────────
  doc.setFillColor(28, 53, 87)
  doc.rect(margin, y, contentW, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text((nr.jatha_name ?? 'NOMINAL ROLE').toUpperCase(), pageW / 2, y + 6, { align: 'center' })
  y += 11

  // ── HEADER INFO ──────────────────────────────────────────────
  doc.setTextColor(0)
  const totalMale   = sections.reduce((s, sec) => s + sec.members.filter(m => m.gender === 'M').length, 0)
  const totalFemale = sections.reduce((s, sec) => s + sec.members.filter(m => m.gender === 'F').length, 0)
  const totalAll    = totalMale + totalFemale

  autoTable(doc, {
    startY: y,
    body: [[
      { content: 'Destination', styles: { fontStyle: 'bold', fillColor: [245, 245, 245] as [number,number,number], cellWidth: 28 } },
      `${nr.destination ?? '—'} · ${nr.department ?? '—'}`,
      { content: 'Dates', styles: { fontStyle: 'bold', fillColor: [245, 245, 245] as [number,number,number], cellWidth: 20 } },
      `${fmtShort(nr.from_date)} to ${fmtShort(nr.to_date)}`,
      { content: 'Total', styles: { fontStyle: 'bold', fillColor: [245, 245, 245] as [number,number,number], cellWidth: 18 } },
      `${totalAll} (M:${totalMale} F:${totalFemale})`,
    ]],
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
    if (nr.jathedar_phone) doc.text(`Ph: ${nr.jathedar_phone}`, margin + 100, y + 5)
    const jatSRS = sections.find(s => s.centre === jathedar.contributing_centre)?.srs_id
    if (jatSRS) doc.text(`SRS: ${jatSRS}`, margin + 160, y + 5)
    y += 10
  }

  // ── VEHICLE ──────────────────────────────────────────────────
  if (nr.vehicle_type) {
    const isT  = nr.vehicle_type === 'Train'
    const vStr = [
      `Vehicle: ${nr.vehicle_type}`,
      nr.driver_name   && `${isT ? 'Train Name' : 'Driver'}: ${nr.driver_name}`,
      nr.driver_mobile && `${isT ? 'Time' : 'Mobile'}: ${nr.driver_mobile}`,
    ].filter(Boolean).join('   |   ')
    doc.setTextColor(80)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(vStr, margin, y + 4)
    y += 7
  }

  // ── MEMBER TABLE — one section per centre ─────────────────────
  for (const section of sections) {
    if (section.members.length === 0) continue

    const secMale   = section.members.filter(m => m.gender === 'M').length
    const secFemale = section.members.filter(m => m.gender === 'F').length

    const sorted = [
      ...section.members.filter(m => m.gender === 'M').sort((a,b) => a.name.localeCompare(b.name)),
      ...section.members.filter(m => m.gender === 'F').sort((a,b) => a.name.localeCompare(b.name)),
    ]

    const sectionTitle = `${section.centre}${section.srs_id ? '   SRS: ' + section.srs_id : ''}   (M:${secMale}  F:${secFemale})`

    const tableBody = sorted.map((m, idx) => [
      String(idx + 1),
      m.name + (m.is_jathedar ? '  ★' : ''),
      m.father_name ?? '—',
      m.age != null ? String(m.age) : '—',
      m.gender === 'M' ? 'M' : 'F',
      m.address ?? '—',
      m.mobile ?? '—',
      section.srs_id ?? '—',
    ])

    autoTable(doc, {
      startY: y + 1,
      head: [
        [{ content: sectionTitle, colSpan: 8 }],
        ['S.No', 'Name', 'Father Name', 'Age', 'M/F', 'Address', 'Mobile', 'SRS ID'],
      ],
      body: tableBody,
      theme: 'striped',
      // Single headStyles object — section title row styled via didParseCell
      headStyles: {
        fillColor: [107, 30, 46] as [number,number,number],
        textColor: [255, 255, 255] as unknown as string,
        fontSize: 7.5,
        fontStyle: 'bold' as const,
        halign: 'center' as const,
      },
      bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' as const },
        1: { cellWidth: 42, fontStyle: 'bold' as const },
        2: { cellWidth: 35 },
        3: { cellWidth: 10, halign: 'center' as const },
        4: { cellWidth: 10, halign: 'center' as const },
        5: { cellWidth: 60 },
        6: { cellWidth: 26 },
        7: { cellWidth: 20, halign: 'center' as const },
      },
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      alternateRowStyles: { fillColor: [252, 248, 248] as [number,number,number] },
      didParseCell: (data: any) => {
        // Section title row — navy background, left aligned
        if (data.section === 'head' && data.row.index === 0) {
          data.cell.styles.fillColor = [28, 53, 87]
          data.cell.styles.fontSize  = 8.5
          data.cell.styles.halign    = 'left'
          data.cell.styles.fontStyle = 'bold'
        }
        // Jathedar row — gold highlight
        if (data.section === 'body') {
          const rowContent = tableBody[data.row.index]
          if (rowContent && String(rowContent[1]).includes('★')) {
            data.cell.styles.fillColor = [255, 243, 200]
            data.cell.styles.textColor = [107, 30, 46]
          }
        }
      },
      didDrawPage: (_data: any) => {
        const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 4, { align: 'right' })
        doc.text(`ASMS Faridabad · Generated ${new Date().toLocaleDateString('en-IN')}`, margin, pageH - 4)
      },
    })

    y = (doc as any).lastAutoTable.finalY + 3
  }

  // ── GRAND TOTAL ───────────────────────────────────────────────
  doc.setFillColor(245, 245, 245)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setTextColor(0)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `Grand Total: ${totalAll} Sewadars   |   Male: ${totalMale}   |   Female: ${totalFemale}`,
    pageW / 2, y + 4.5, { align: 'center' }
  )
  y += 11

  // ── SIGNATURE BLOCKS ─────────────────────────────────────────
  const allSigCentres = [...sections.map(s => s.centre), 'ASO / Area HQ']
  const sigBoxW       = Math.min(48, contentW / allSigCentres.length - 2)
  let sigX            = margin

  for (const label of allSigCentres) {
    if (y + 22 > pageH - margin) break
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.line(sigX, y + 12, sigX + sigBoxW, y + 12)
    doc.text('Signature', sigX, y + 15)
    doc.text(label, sigX, y + 19, { maxWidth: sigBoxW })
    sigX += sigBoxW + 4
  }

  doc.save(`${(nr.jatha_name ?? 'NR').replace(/\s+/g, '_')}_NR.pdf`)
}
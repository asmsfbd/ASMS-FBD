import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

/* ---------- Types ---------- */

export interface NRForPDF {
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

export interface SectionForPDF {
  centre: string
  srs_id: string | null
  is_ready: boolean
  members: MemberForPDF[]
}

export interface MemberForPDF {
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
}

export interface GeneratePDFOptions {
  nr: NRForPDF
  sections: SectionForPDF[]
  jathedar: MemberForPDF | null
}

/* ---------- Page constants ---------- */

const PW = 210
const PH = 297
const ML = 12
const MR = 12
const MT = 10
const MB = 10

const CW = PW - ML - MR

/* ---------- Column widths (Official proportions) ---------- */

const COL = {
  sno: 6,
  badge: 25,
  name: 28,
  father: 24,
  gender: 6,
  age: 6,
  address: 55,
  centre: 36
}

/* ---------- Helpers ---------- */

function formatDate(d: string | null) {
  if (!d) return ""
  const dt = new Date(d)

  return `${String(dt.getDate()).padStart(2, "0")}-${String(
    dt.getMonth() + 1
  ).padStart(2, "0")}-${dt.getFullYear()}`
}

function today() {
  return formatDate(new Date().toISOString())
}

function days(f: string | null, t: string | null) {
  if (!f || !t) return "1"
  return String(
    Math.round(
      (new Date(t).getTime() - new Date(f).getTime()) / 86400000
    ) + 1
  )
}

/* ---------- Header ---------- */

function drawHeader(doc: jsPDF, nr: NRForPDF, title: string, jathedar: MemberForPDF | null) {

  doc.setFont("helvetica", "normal")

  doc.setFontSize(7)
  doc.text("SCI/2020/84", PW - MR, MT + 3, { align: "right" })

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("SATSANG CENTRES IN INDIA", PW / 2, MT + 10, { align: "center" })

  doc.setFontSize(9)
  doc.text(`NOMINAL ROLL OF JATHA ${title}`, PW / 2, MT + 16, {
    align: "center"
  })

  let y = MT + 24

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)

  const place = nr.centre.toUpperCase()

  doc.text(`Name of Satsang Place : ${place}`, ML, y)
  doc.text(`Area : FARIDABAD : ZONE: III`, ML + CW / 2, y)

  y += 6

  doc.text(
    `Name of Jathedar : ${(jathedar?.name || "").toUpperCase()}`,
    ML,
    y
  )

  doc.text(
    `Train Name & Time : ${nr.driver_name || ""}`,
    ML + CW / 2,
    y
  )

  y += 6

  doc.text(`Mobile No : ${jathedar?.mobile || ""}`, ML, y)

  doc.text(
    `Type of Vehicle / Vehicle No : ${nr.vehicle_type || ""}`,
    ML + CW / 2,
    y
  )

  y += 6

  doc.text(`Place of Sewa : ${nr.destination || "BEAS"}`, ML, y)

  doc.text(
    `Department : ${(nr.department || "").toUpperCase()}`,
    ML + CW / 2,
    y
  )

  return y + 6
}

/* ---------- Member Table ---------- */

function drawTable(
  doc: jsPDF,
  nr: NRForPDF,
  members: MemberForPDF[],
  gender: "M" | "F",
  startY: number
) {

  const rows = members.map((m, i) => [

    i + 1,

    m.display_id,

    m.name,

    m.father_name || "—",

    m.gender,

    m.age || "",

    `${m.address || ""}\n${m.mobile || ""}`,

    `${m.contributing_centre}\n`
  ])

  autoTable(doc, {

    startY,

    theme: "grid",

    styles: {
      fontSize: 7,
      cellPadding: 2,
      lineWidth: 0.25
    },

    head: [[
      "Sno",
      "Badge No.\nAadhar No.",
      "Sewadar's Name",
      "Father's Name",
      "M/F",
      "Age",
      "Address & Phone No.",
      "Centre / SRS ID"
    ]],

    body: rows,

    columnStyles: {

      0: { cellWidth: COL.sno, halign: "center" },

      1: { cellWidth: COL.badge },

      2: { cellWidth: COL.name },

      3: { cellWidth: COL.father },

      4: { cellWidth: COL.gender, halign: "center" },

      5: { cellWidth: COL.age, halign: "center" },

      6: { cellWidth: COL.address },

      7: { cellWidth: COL.centre }
    }
  })

  const y = (doc as any).lastAutoTable.finalY + 6

  drawTotals(doc, nr, members, gender, y)

  return y
}

/* ---------- Totals ---------- */

function drawTotals(
  doc: jsPDF,
  nr: NRForPDF,
  members: MemberForPDF[],
  gender: "M" | "F",
  y: number
) {

  const male = members.filter(m => m.gender === "M").length
  const female = members.filter(m => m.gender === "F").length

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)

  doc.text("TOTAL SEWADARS", ML + 40, y)

  doc.text("M", ML + 90, y)

  doc.text("F", ML + 100, y)

  doc.setFont("helvetica", "normal")

  doc.text(String(male + female), ML + 90, y + 6)

  doc.text(String(male), ML + 90, y + 12)

  doc.text(String(female), ML + 100, y + 12)
}

/* ---------- Footer ---------- */

function drawFooter(doc: jsPDF, nr: NRForPDF) {

  const y = PH - 55

  doc.setFontSize(8)

  doc.text("Signature of Jathedar", ML, y)

  doc.text("Name", ML, y + 7)

  doc.text("Date", ML, y + 14)

  doc.line(ML + 30, y + 1, ML + 90, y + 1)

  doc.line(ML + 30, y + 8, ML + 90, y + 8)

  doc.line(ML + 30, y + 15, ML + 90, y + 15)

  doc.text("Secretary / Area Secretary", PW - 80, y + 7)

  doc.text(`( Stamp )   Date : ${today()}`, PW - 80, y + 14)

  doc.setDrawColor(200)

  doc.line(ML, y + 22, PW - MR, y + 22)

  doc.text(
    `Arrival Date & Time : ${formatDate(nr.from_date)} - 03:20 PM`,
    ML,
    y + 30
  )

  doc.text(
    `Departure Date & Time : ${formatDate(nr.to_date)} - 03:20 PM`,
    ML,
    y + 36
  )

  doc.line(ML, y + 42, PW - MR, y + 42)
}

/* ---------- Main Export ---------- */

export async function generateNRPDF(opts: GeneratePDFOptions) {

  const { nr, sections, jathedar } = opts

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  })

  const members = sections.flatMap(s => s.members)

  const maleMembers = members.filter(m => m.gender === "M")

  const femaleMembers = members.filter(m => m.gender === "F")

  /* ---- Male page ---- */

  let y = drawHeader(doc, nr, "MALE", jathedar)

  y = drawTable(doc, nr, maleMembers, "M", y)

  drawFooter(doc, nr)

  /* ---- Female page ---- */

  if (femaleMembers.length) {

    doc.addPage()

    y = drawHeader(doc, nr, "FEMALE", jathedar)

    y = drawTable(doc, nr, femaleMembers, "F", y)

    drawFooter(doc, nr)
  }

  const filename =
    (nr.jatha_name || "NR").replace(/\s+/g, "_") + "_NR.pdf"

  doc.save(filename)
}

/**
 * NR PDF — Official RSSB Faridabad Format
 * Pure browser-native: jsPDF + jspdf-autotable
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* ---------- TYPES ---------- */

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

/* ---------- COLORS ---------- */

const BLK: [number,number,number] = [0,0,0]
const GRY: [number,number,number] = [200,200,200]
const WHT: [number,number,number] = [255,255,255]
const ALT: [number,number,number] = [247,247,247]

/* ---------- PAGE ---------- */

const PW=210
const PH=297
const ML=12
const MR=12
const MT=10
const MB=10
const CW=PW-ML-MR

/* ---------- MEMBER TABLE WIDTHS (FIXED) ---------- */

const C0 = 6
const C1 = 26
const C2 = 28
const C3 = 24
const C4 = 6
const C5 = 6

const C6a = 56
const C7 = CW-(C0+C1+C2+C3+C4+C5+C6a)

const COLS=[C0,C1,C2,C3,C4,C5,C6a,C7]

/* ---------- HEADER WIDTHS ---------- */

const HL1=28
const HC1=4
const HV1=CW/2-HL1-HC1

const HL2=32
const HC2=4
const HV2=CW/2-HL2-HC2

/* ---------- SIGNATURE WIDTHS ---------- */

const SA=C0+C1
const SB=C2+C3
const SC=C4+C5+C6a*0.6
const SE=C6a*0.4+C7

/* ---------- HELPERS ---------- */

function fd(d: string|null): string {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`
  } catch { return d }
}

function days(f:string|null,t:string|null): string {
  if (!f||!t) return '1'
  return String(Math.round((new Date(t).getTime()-new Date(f).getTime())/86400000)+1)
}

function td(): string {
  const d=new Date()
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

/* ---------- SHEET ---------- */

function sheet(
  doc: jsPDF,
  nr: NRForPDF,
  sections: SectionForPDF[],
  jathedar: MemberForPDF|null,
  gf: 'M'|'F',
  lbl: 'MALE'|'FEMALE',
  first: boolean
){

const secs = sections
.map(s=>({...s,members:s.members.filter(m=>m.gender.toUpperCase()===gf)}))
.filter(s=>s.members.length>0)

if(!secs.length)return
if(!first)doc.addPage()

const jath = secs.flatMap(s=>s.members).find(m=>m.is_jathedar) ?? jathedar

const place = sections.map(s=>s.centre).join(' | ').toUpperCase()

const isT=(nr.vehicle_type??'').toUpperCase()==='TRAIN'

const drvLbl=isT?'Train Name & Time':'Name of Driver & Mobile No'

const drvV=nr.driver_name
?`${nr.driver_name}${nr.driver_mobile?' | '+nr.driver_mobile:''}`
:''

const jathName=(jath?.name??'').toUpperCase()
const jathMob=jath?.mobile??''

doc.setFontSize(7)
doc.text('SCI/2020/84',PW-MR,MT+3,{align:'right'})

let y=MT+6

doc.setFontSize(11)
doc.setFont('helvetica','bold')
doc.text('SATSANG CENTRES IN INDIA',PW/2,y+5,{align:'center'})

y+=7

doc.setFontSize(9)
doc.text(`NOMINAL ROLL OF JATHA ${lbl}`,PW/2,y+4,{align:'center'})

y+=8

/* ---------- HEADER TABLE ---------- */

autoTable(doc,{
startY:y,

body:[
['Name of Satsang Place',':',place,'Area : FARIDABAD',':','ZONE: III'],
['Name of Jathedar',':',jathName,drvLbl,':',drvV],
['Mobile No',':',jathMob,'Type of Vehicle / Vehicle No',':',nr.vehicle_type??''],
['Place of Sewa',':',nr.destination??'BEAS','Department',':',(nr.department??'').toUpperCase()],
],

columnStyles:{
0:{cellWidth:HL1},
1:{cellWidth:HC1,halign:'center'},
2:{cellWidth:HV1,fontStyle:'bold'},
3:{cellWidth:HL2},
4:{cellWidth:HC2,halign:'center'},
5:{cellWidth:HV2,fontStyle:'bold'},
},

theme:'plain',

styles:{
fontSize:8,
cellPadding:{top:2.5,bottom:2.5,left:3,right:2},
valign:'middle',
overflow:'linebreak'
},

margin:{left:ML,right:MR},
tableWidth:CW,

didDrawCell:(d)=>{
if(d.section==='body'&&(d.column.index===2||d.column.index===5)){
doc.setDrawColor(...GRY)
doc.setLineWidth(0.25)
doc.line(d.cell.x,d.cell.y+d.cell.height,d.cell.x+d.cell.width,d.cell.y+d.cell.height)
}
}

})

y=(doc as any).lastAutoTable.finalY+2

/* ---------- MEMBERS ---------- */

const allM = secs.flatMap(s=>s.members.map(m=>({...m,_ctr:s.centre,_srs:s.srs_id??'—'})))

const mc=allM.filter(m=>m.gender.toUpperCase()==='M').length
const fc=allM.filter(m=>m.gender.toUpperCase()==='F').length
const tot=nr.member_count??(mc+fc)

const d5=days(nr.from_date,nr.to_date)

const dataRows=allM.map((m,i)=>{

let age='—'
try{if(m.age!=null)age=String(Math.floor(Number(m.age)))}catch{}

const addr=(m.address??'—')+(m.mobile?'\n'+m.mobile:'')

return[
String(i+1),
m.display_id,
m.name,
m.father_name??'—',
m.gender,
age,
addr,
`${m._ctr}\n${m._srs}`
]

})

const de=2+dataRows.length

const body:any[]=[

[`Sewa duration (No_Of_Days)   ${d5} Days`,'','',`Date ( From ) :  ${fd(nr.from_date)}`,'','',`Date ( To ) :  ${fd(nr.to_date)}`,''],

['Sno','Badge No.\nAadhar No.',"Sewadar's\nName","Father's\nName",'M/F','Age','Address &\nPhone No.','Centre /\nSRS ID'],

...dataRows,

['','','TOTAL SEWADARS','','M','F',String(tot),''],

['','','','',gf==='M'?String(mc):'',String(fc),'','']

]

autoTable(doc,{

startY:y,
body,

columnStyles:{
0:{cellWidth:COLS[0],halign:'center'},
1:{cellWidth:COLS[1]},
2:{cellWidth:COLS[2]},
3:{cellWidth:COLS[3]},
4:{cellWidth:COLS[4],halign:'center'},
5:{cellWidth:COLS[5],halign:'center'},
6:{cellWidth:COLS[6],overflow:'linebreak'},
7:{cellWidth:COLS[7],halign:'center'}
},

theme:'grid',

styles:{
fontSize:7,
cellPadding:{top:1.5,bottom:1.5,left:1.5,right:1.5},
lineColor:GRY,
lineWidth:0.25,
textColor:BLK,
valign:'top',
overflow:'linebreak'
},

margin:{left:ML,right:MR},
tableWidth:CW,

didParseCell:(data)=>{

const ri=data.row.index
const ci=data.column.index

if(ri===0){

data.cell.styles.fontStyle='bold'
data.cell.styles.valign='middle'
data.cell.styles.fillColor=WHT

if(ci===0)(data.cell as any).colSpan=3
else if(ci===3)(data.cell as any).colSpan=3
else if(ci===6)(data.cell as any).colSpan=2
else data.cell.styles.lineWidth=0

}

if(ri===1){

data.cell.styles.fontStyle='bold'
data.cell.styles.halign='center'
data.cell.styles.valign='middle'
data.cell.styles.fillColor=WHT
data.cell.styles.fontSize=7

}

if(ri>=2&&ri<de&&ri%2===0)data.cell.styles.fillColor=ALT

if(ri===de||ri===de+1){

data.cell.styles.fontStyle='bold'
data.cell.styles.halign='center'
data.cell.styles.valign='middle'

if(ci<=1||ci===7){
data.cell.styles.lineWidth=0
}

if(ci===2)(data.cell as any).colSpan=2
if(ci===6&&ri===de)(data.cell as any).rowSpan=2

}

},

didDrawCell:(data)=>{

if(data.row.index===de&&data.column.index===2){

const bw=COLS[2]+COLS[3]+COLS[4]+COLS[5]+COLS[6]
const bh=data.cell.height*2

doc.setDrawColor(...BLK)
doc.setLineWidth(0.5)

doc.rect(data.cell.x,data.cell.y,bw,bh)

}

}

})

/* ---------- FOOTER ---------- */

const fY = PH - MB - 48

doc.setFontSize(8)

const lx=ML
const ux=ML+SA-2
const ue=ML+SA+SB

doc.text('Signature of Jathedar',lx,fY+6)
doc.text('Name',lx,fY+13)
doc.text('Date',lx,fY+20)

doc.setDrawColor(...BLK)
doc.setLineWidth(0.4)

doc.line(ux,fY+7,ue,fY+7)
doc.line(ux,fY+14,ue,fY+14)
doc.line(ux,fY+21,ue,fY+21)

doc.setFont('helvetica','bold')
doc.text(jathName,ux+1,fY+13)
doc.setFont('helvetica','normal')

const rx=ML+SA+SB+SC
const rw=SE

doc.line(rx,fY+8,rx+rw,fY+8)

doc.text('Secretary / Area Secretary',rx+rw/2,fY+14,{align:'center'})
doc.text(`( Stamp )   Date : ${td()}`,rx+rw/2,fY+20,{align:'center'})

const eq1Y=fY+26

doc.setDrawColor(...GRY)
doc.setLineWidth(0.25)
doc.line(ML,eq1Y,ML+CW,eq1Y)

const aY=eq1Y+4

doc.setFontSize(8.5)
doc.setFont('helvetica','bold')

doc.text('Arrival Date & Time',ML,aY+5)
doc.text('Departure Date & Time',ML,aY+11)

doc.setFont('helvetica','normal')
doc.setFontSize(8)

doc.text(`: ${fd(nr.from_date)} - 03:20 PM`,ML+CW*0.32,aY+5)
doc.text(`: ${fd(nr.to_date)}   - 03:20 PM`,ML+CW*0.32,aY+11)

}

/* ---------- EXPORT ---------- */

export async function generateNRPDF(opts: GeneratePDFOptions){

const{nr,sections,jathedar}=opts

const doc=new jsPDF({
orientation:'portrait',
unit:'mm',
format:'a4'
})

sheet(doc,nr,sections,jathedar,'M','MALE',true)
sheet(doc,nr,sections,jathedar,'F','FEMALE',false)

const fn=`${(nr.jatha_name??'NR').replace(/[^a-zA-Z0-9_\- ]/g,'').replace(/\s+/g,'_')}_NR.pdf`

doc.save(fn)

}

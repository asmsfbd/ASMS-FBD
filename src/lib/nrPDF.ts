/**
 * NR PDF Generator — Official RSSB Faridabad Format
 * Calls Anthropic API to run server-side reportlab Python
 * Portrait A4 | Male + Female pages | Footer pinned to bottom
 * Logo overlaid top-left | Titles centred unaffected
 */

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
}
export interface GeneratePDFOptions {
  nr: NRForPDF; sections: SectionForPDF[]; jathedar: MemberForPDF | null
}

// ── RSSB Logo (base64) ───────────────────────────────────────
const LOGO_B64 = '__LOGO_PLACEHOLDER__'

// ── Python PDF code (run server-side via Anthropic API) ──────
function buildPythonCode(dataJson: string, logoB64: string): string {
  return `
import io, base64, json
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Table, TableStyle,
    Paragraph, Spacer, KeepInFrame, FrameBreak, NextPageTemplate, PageBreak)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import tempfile, os

data = json.loads(${JSON.stringify(dataJson)})
nr = data['nr']; sections_data = data['sections']; jathedar = data.get('jathedar')

# Write logo to temp file
logo_bytes = base64.b64decode(${JSON.stringify(logoB64)})
logo_tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
logo_tmp.write(logo_bytes); logo_tmp.close()
LOGO_PATH = logo_tmp.name

BLACK=colors.black; WHITE=colors.white
GRID_LINE=colors.HexColor('#CCCCCC'); ALT_ROW=colors.HexColor('#F7F7F7')
PAGE_W,PAGE_H=A4; ML=MR=12*mm; MT=MB=10*mm; CW_=PAGE_W-ML-MR
LOGO_W=16*mm; LOGO_H=LOGO_W*(177/148)
LOGO_SPACER=LOGO_H-(13*mm)+2*mm
FOOTER_H=52*mm; BODY_H=PAGE_H-MT-MB-FOOTER_H

def S(n,**k): return ParagraphStyle(n,**k)
sN  =S('N',  fontName='Helvetica',      fontSize=8,   leading=10)
sT  =S('T',  fontName='Helvetica-Bold', fontSize=11,  leading=14, alignment=TA_CENTER)
sST =S('ST', fontName='Helvetica-Bold', fontSize=9,   leading=11, alignment=TA_CENTER)
sR  =S('R',  fontName='Helvetica',      fontSize=7,   leading=9,  alignment=TA_RIGHT)
sC  =S('C',  fontName='Helvetica',      fontSize=7.5, leading=9.5)
sCB =S('CB', fontName='Helvetica-Bold', fontSize=7.5, leading=9.5)
sCR =S('CR', fontName='Helvetica',      fontSize=7.5, leading=9.5, alignment=TA_CENTER)
sCBR=S('CBR',fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, alignment=TA_CENTER)
sLBL=S('LBL',fontName='Helvetica',      fontSize=8,   leading=10)
sCOL=S('COL',fontName='Helvetica',      fontSize=8,   leading=10, alignment=TA_CENTER)
sHV =S('HV', fontName='Helvetica-Bold', fontSize=8,   leading=10)
sHC =S('HC', fontName='Helvetica',      fontSize=8,   leading=10, alignment=TA_CENTER)
sHVC=S('HVC',fontName='Helvetica-Bold', fontSize=8,   leading=10, alignment=TA_CENTER)
sARR=S('AR', fontName='Helvetica-Bold', fontSize=8.5, leading=12)
sEQ =S('EQ', fontName='Courier',        fontSize=7,   leading=9)
sDR =S('DR', fontName='Helvetica',      fontSize=7.5, leading=9)
sDRV=S('DRV',fontName='Helvetica-Bold', fontSize=7.5, leading=9)

def p(t,s=None): return Paragraph(str(t) if t is not None else '',s or sN)
def fmt_d(d):
    if not d: return ''
    try: dt=datetime.fromisoformat(str(d).split('T')[0]); return dt.strftime('%d-%m-%Y')
    except: return str(d)
def days_b(f,t):
    if not f or not t: return '1'
    try:
        d1=datetime.fromisoformat(str(f).split('T')[0])
        d2=datetime.fromisoformat(str(t).split('T')[0])
        return str(abs((d2-d1).days)+1)
    except: return '1'

C0=CW_*0.042;C1=CW_*0.120;C2=CW_*0.130;C3=CW_*0.115;C4=CW_*0.038;C5=CW_*0.038
rem=CW_-C0-C1-C2-C3-C4-C5; C6=rem*0.62; C7=rem*0.38
COL_W=[C0,C1,C2,C3,C4,C5,C6,C7]
HC_LBL1=CW_*0.155; HC_COL1=4*mm; HC_VAL1=CW_*0.50-HC_LBL1-HC_COL1
HC_LBL2=CW_*0.175; HC_COL2=4*mm; HC_VAL2=CW_*0.50-HC_LBL2-HC_COL2
SIG_A=C0+C1; SIG_B=C2+C3; SIG_C=C4+C5+(C6*0.60); SIG_E=C6*0.40+C7
eq_chars=int(CW_/(7*0.601)); EQ_LINE='='*eq_chars

def draw_logo(canv,doc):
    canv.saveState()
    canv.drawImage(LOGO_PATH,ML,PAGE_H-MT-LOGO_H,width=LOGO_W,height=LOGO_H,preserveAspectRatio=True,mask='auto')
    canv.restoreState()

def build_body(gf,lbl):
    secs=[{**s,'members':[m for m in s['members'] if str(m.get('gender','')).upper()==gf]} for s in sections_data]
    secs=[s for s in secs if s['members']]
    if not secs: return []
    jath=next((m for s in secs for m in s['members'] if m.get('is_jathedar')),jathedar)
    place=(' | '.join(s['centre'] for s in sections_data)).upper()
    is_t=str(nr.get('vehicle_type') or '').upper()=='TRAIN'
    drv_lbl='Train Name & Time' if is_t else 'Name of Driver & Mobile No'
    drv_v=str(nr.get('driver_name') or '')
    if nr.get('driver_mobile'): drv_v+=' | '+str(nr['driver_mobile'])
    jath_mobile=str(jath.get('mobile') or '') if jath else ''
    jath_name=jath['name'].upper() if jath else ''
    st=[]
    st.append(p('SCI/2020/84',sR)); st.append(Spacer(1,1*mm))
    st.append(p('SATSANG CENTRES IN INDIA',sT))
    st.append(p(f'NOMINAL ROLL OF JATHA {lbl}',sST))
    st.append(Spacer(1,LOGO_SPACER))
    hdr=[
        [p('Name of Satsang Place',sLBL),p(':',sCOL),p(place,sHV),p('Area : FARIDABAD',sLBL),p(':',sCOL),p('ZONE: III',sHV)],
        [p('Name of Jathedar',sLBL),p(':',sCOL),p(jath_name,sHV),p(drv_lbl,sLBL),p(':',sCOL),p(drv_v,sHV)],
        [p('Mobile No',sLBL),p(':',sCOL),p(jath_mobile,sHV),p('Type of Vehicle / Vehicle No',sLBL),p(':',sCOL),p(str(nr.get('vehicle_type') or ''),sHV)],
        [p('Place of Sewa',sLBL),p(':',sCOL),p(str(nr.get('destination') or 'BEAS').upper(),sHV),p('Department',sLBL),p(':',sCOL),p(str(nr.get('department') or '').upper(),sHV)],
    ]
    ht=Table(hdr,colWidths=[HC_LBL1,HC_COL1,HC_VAL1,HC_LBL2,HC_COL2,HC_VAL2])
    ht.setStyle(TableStyle([
        ('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),2),
        ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),
        ('VALIGN',(0,0),(-1,-1),'BOTTOM'),
        ('LEFTPADDING',(1,0),(1,-1),0),('RIGHTPADDING',(1,0),(1,-1),0),
        ('LEFTPADDING',(4,0),(4,-1),0),('RIGHTPADDING',(4,0),(4,-1),0),
        ('LINEBELOW',(2,0),(2,0),0.5,BLACK),('LINEBELOW',(2,1),(2,1),0.5,BLACK),
        ('LINEBELOW',(2,2),(2,2),0.5,BLACK),('LINEBELOW',(2,3),(2,3),0.5,BLACK),
        ('LINEBELOW',(5,0),(5,0),0.5,BLACK),('LINEBELOW',(5,1),(5,1),0.5,BLACK),
        ('LINEBELOW',(5,2),(5,2),0.5,BLACK),('LINEBELOW',(5,3),(5,3),0.5,BLACK),
    ]))
    st.append(ht); st.append(Spacer(1,2*mm))
    all_m=[(sec,m) for sec in secs for m in sec['members']]
    rows=[]
    days_val=days_b(nr.get('from_date'),nr.get('to_date'))
    rows.append([p('Sewa duration (No_Of_Days)',sDR),p(''),p(''),p(f'{days_val} Days',sDRV),p(''),p(f"Date ( From ) :  {fmt_d(nr.get('from_date'))}",sDR),p(''),p(f"Date ( To ) :  {fmt_d(nr.get('to_date'))}",sDR)])
    rows.append([p('Sno',sCBR),p('Badge No.\\nAadhar No.',sCB),p("Sewadar's Name",sCB),p("Father's Name",sCB),p('M/F',sCBR),p('Age',sCBR),p('Address & Phone No.',sCB),p('Centre / SRS ID',sCBR)])
    for i,(sec,m) in enumerate(all_m,start=1):
        try: age=str(int(float(m['age']))) if m.get('age') is not None else '—'
        except: age='—'
        addr=str(m.get('address') or '—')
        if m.get('mobile'): addr+='\\n'+str(m['mobile'])
        rows.append([p(str(i),sC),p(str(m.get('display_id') or ''),sC),p(str(m.get('name') or ''),sC),p(str(m.get('father_name') or '—'),sC),p(str(m.get('gender') or ''),sC),p(age,sC),p(addr,sC),p(f"{sec['centre']}\\n{sec.get('srs_id') or '—'}",sCR)])
    de=len(rows)
    mc=sum(1 for _,m in all_m if str(m.get('gender','')).upper()=='M')
    fc=sum(1 for _,m in all_m if str(m.get('gender','')).upper()=='F')
    tot=nr.get('member_count',mc+fc)
    rows.append([p(''),p(''),p('TOTAL SEWADARS',sCBR),p(''),p('M',sCBR),p('F',sCBR),p(str(tot),sCBR),p('')])
    if gf=='M': rows.append([p(''),p(''),p(''),p(''),p(str(mc),sCBR),p(str(fc),sCBR),p(''),p('')])
    else: rows.append([p(''),p(''),p(''),p(''),p(''),p(str(fc),sCBR),p(''),p('')])
    ts=[
        ('GRID',(0,0),(-1,-1),0.4,GRID_LINE),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),2),('RIGHTPADDING',(0,0),(-1,-1),2),
        ('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2),
        ('SPAN',(0,0),(2,0)),('SPAN',(3,0),(4,0)),('SPAN',(5,0),(6,0)),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('VALIGN',(0,0),(-1,0),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,0),4),('BOTTOMPADDING',(0,0),(-1,0),4),
        ('FONTNAME',(0,1),(-1,1),'Helvetica-Bold'),('ALIGN',(0,1),(-1,1),'CENTER'),
        ('VALIGN',(0,1),(-1,1),'MIDDLE'),('TOPPADDING',(0,1),(-1,1),3),('BOTTOMPADDING',(0,1),(-1,1),4),
        ('SPAN',(2,de),(3,de+1)),('SPAN',(6,de),(6,de+1)),
        ('ALIGN',(2,de),(3,de+1),'CENTER'),('ALIGN',(4,de),(6,de+1),'CENTER'),
        ('VALIGN',(2,de),(3,de+1),'MIDDLE'),('VALIGN',(6,de),(6,de+1),'MIDDLE'),
        ('FONTNAME',(0,de),(-1,de+1),'Helvetica-Bold'),
        ('BOX',(2,de),(6,de+1),0.8,BLACK),('BACKGROUND',(0,de),(-1,de+1),WHITE),
        ('LINEAFTER',(0,de),(0,de+1),0,WHITE),('LINEBEFORE',(0,de),(0,de+1),0,WHITE),
        ('LINEAFTER',(1,de),(1,de+1),0,WHITE),('LINEBEFORE',(1,de),(1,de+1),0,WHITE),
        ('LINEAFTER',(7,de),(7,de+1),0,WHITE),('LINEBEFORE',(7,de),(7,de+1),0,WHITE),
        ('LINEABOVE',(0,de),(1,de),0,WHITE),('LINEBELOW',(0,de+1),(1,de+1),0,WHITE),
        ('LINEABOVE',(7,de),(7,de),0,WHITE),('LINEBELOW',(7,de+1),(7,de+1),0,WHITE),
    ]
    for ri in range(2,de):
        if ri%2==0: ts.append(('BACKGROUND',(0,ri),(-1,ri),ALT_ROW))
    mt=Table(rows,colWidths=COL_W,repeatRows=2); mt.setStyle(TableStyle(ts))
    st.append(mt)
    return st

def build_footer(gf):
    secs=[{**s,'members':[m for m in s['members'] if str(m.get('gender','')).upper()==gf]} for s in sections_data]
    secs=[s for s in secs if s['members']]
    jath=next((m for s in secs for m in s['members'] if m.get('is_jathedar')),jathedar)
    jath_name=jath['name'].upper() if jath else ''
    today=datetime.now().strftime('%d-%m-%Y')
    sig_data=[
        [p('Signature of Jathedar',sLBL),p(''),p(''),p('')],
        [p('Name',sLBL),p(jath_name,sHV),p(''),p('Secretary / Area Secretary',sHC)],
        [p('Date',sLBL),p(''),p(''),p(f'( Stamp )   Date : {today}',sHVC)],
    ]
    sig_t=Table(sig_data,colWidths=[SIG_A,SIG_B,SIG_C,SIG_E])
    sig_t.setStyle(TableStyle([
        ('ALIGN',(0,0),(0,-1),'LEFT'),('LEFTPADDING',(0,0),(0,-1),0),
        ('ALIGN',(1,0),(1,-1),'LEFT'),('LEFTPADDING',(1,0),(1,-1),2),
        ('LINEBELOW',(1,0),(1,0),0.5,BLACK),('LINEBELOW',(1,1),(1,1),0.5,BLACK),('LINEBELOW',(1,2),(1,2),0.5,BLACK),
        ('LINEABOVE',(3,1),(3,1),0.5,BLACK),
        ('ALIGN',(3,0),(3,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'BOTTOM'),
        ('LEFTPADDING',(2,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('FONTSIZE',(0,0),(-1,-1),8),
    ]))
    st=[Spacer(1,4*mm)]
    st.append(sig_t); st.append(Spacer(1,5*mm))
    eq_t=Table([[p(EQ_LINE,sEQ)]],colWidths=[CW_])
    eq_t.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    st.append(eq_t); st.append(Spacer(1,2*mm))
    at=Table([[p('Arrival Date & Time',sARR),p(f": {fmt_d(nr.get('from_date'))} - 03:20 PM")],[p('Departure Date & Time',sARR),p(f": {fmt_d(nr.get('to_date'))} - 03:20 PM")]],colWidths=[CW_*0.35,CW_*0.65])
    at.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
    st.append(at); st.append(Spacer(1,2*mm)); st.append(eq_t)
    return st

buf=io.BytesIO()
def frm(pid):
    return [Frame(ML,MB+FOOTER_H,CW_,BODY_H,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0,id=f'b{pid}'),
            Frame(ML,MB,CW_,FOOTER_H,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0,id=f'f{pid}')]
doc=BaseDocTemplate(buf,pagesize=A4,
    pageTemplates=[PageTemplate(id='p1',frames=frm(1),onPage=draw_logo),PageTemplate(id='p2',frames=frm(2),onPage=draw_logo)],
    leftMargin=ML,rightMargin=MR,topMargin=MT,bottomMargin=MB)
story=[]
mb=build_body('M','MALE')
if mb:
    mf_=build_footer('M'); story.append(KeepInFrame(CW_,BODY_H,mb,mode='shrink')); story.append(FrameBreak()); story.append(KeepInFrame(CW_,FOOTER_H,mf_,mode='shrink'))
fb=build_body('F','FEMALE')
if fb:
    ff=build_footer('F'); story.append(NextPageTemplate('p2')); story.append(PageBreak()); story.append(KeepInFrame(CW_,BODY_H,fb,mode='shrink')); story.append(FrameBreak()); story.append(KeepInFrame(CW_,FOOTER_H,ff,mode='shrink'))
doc.build(story)
os.unlink(LOGO_PATH)
print(base64.b64encode(buf.getvalue()).decode())
`
}

export async function generateNRPDF(options: GeneratePDFOptions): Promise<void> {
  const { nr, sections, jathedar } = options
  const filename = `${(nr.jatha_name ?? 'NR').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')}_NR.pdf`
  const payload  = JSON.stringify({ nr, sections, jathedar })

  // Load logo as base64
  let logoB64 = ''
  try {
    const resp = await fetch('/rssb_logo.png')
    const buf  = await resp.arrayBuffer()
    logoB64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  } catch {
    console.warn('Logo not found, PDF will render without logo')
  }

  const pythonCode = buildPythonCode(payload, logoB64)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: `You are a Python execution engine. Run the following Python code exactly as-is and return ONLY the base64-encoded PDF string as a single line of plain text. No explanation, no markdown, no other output whatsoever.

\`\`\`python
${pythonCode}
\`\`\``,
      }],
    }),
  })

  if (!response.ok) throw new Error(`API error ${response.status}`)

  const result = await response.json()
  const b64 = result.content?.find((c: any) => c.type === 'text')?.text?.trim()
  if (!b64 || b64.length < 200) throw new Error('PDF generation failed — empty or invalid response')

  const binary = atob(b64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

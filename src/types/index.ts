export type Role = 'aso' | 'centre_admin' | 'scanner' | 'jatha_sewadar'
export type BadgeStatus = 'Permanent' | 'Open' | 'Elderly' | 'Withdrawn' | 'Expired' | 'Cancelled'
export type Gender = 'M' | 'F'
export type AttendanceType = 'IN' | 'OUT'
export type DutyType = 'satsang_point' | 'daily_duty'
export type NRStatus = 'draft' | 'submitted' | 'approved' | 'issued' | 'rejected'

export interface AppUser {
  id: number
  auth_id: string
  badge_number: string
  role: Role
  centre: string
  is_active: boolean
  name: string
}

export interface Sewadar {
  id: number
  badge_number: string
  name: string
  father_name: string | null
  gender: Gender
  age: number | null
  mobile: string | null
  address: string | null
  centre: string
  department: string | null
  is_special_dept: boolean
  is_scannable: boolean
  badge_status: BadgeStatus
  is_active: boolean
}

export interface Centre {
  id: number
  centre_name: string
  parent_centre: string | null
  area_label: string
  latitude: number | null
  longitude: number | null
  is_active: boolean
}

export interface AttendanceRecord {
  id: number
  badge_number: string
  sewadar_name: string
  centre: string
  scan_centre: string
  department: string | null
  type: AttendanceType
  duty_type: DutyType
  scan_time: string
  scanner_badge: string
  scanner_name: string
}

export interface JathaSchedule {
  id: number
  jatha_name: string
  destination: string
  department: string
  is_bhati: boolean
  from_date: string
  to_date: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface NRSummary {
  id: number
  centre: string
  status: NRStatus
  srs_id: string
  jatha_name: string
  schedule_dates: string
  destination: string
  department: string
  from_date: string
  to_date: string
  is_bhati: boolean
  quota: number
  member_count: number
  male_count: number
  female_count: number
  jathedar_name: string
}

export type ScanResult =
  | { status: 'success';  sewadar: Sewadar; action: AttendanceType }
  | { status: 'blocked';  sewadar: Sewadar; jatha_name: string; from_date: string; to_date: string }
  | { status: 'invalid';  message: string }
  | { status: 'inactive'; sewadar: Sewadar }
  | { status: 'scope';    sewadar: Sewadar }

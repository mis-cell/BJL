import React from 'react';
import {
  User,
  ClipboardList,
  Terminal,
  Layers,
  FileText,
  Archive,
  CheckCircle2,
  Box,
  Users,
  MapPin,
  Scale,
  DollarSign,
  Calendar,
  HelpCircle,
  Key,
  Briefcase,
  Notebook,
  Building,
  GraduationCap,
  Award,
  BookOpen,
  Contact,
  UserCheck,
  ShieldAlert,
  MessageSquare
} from 'lucide-react';

export interface TableDef {
  name: string;
  label: string;
  icon: any;
  pk: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  details: string;
  currentPage: string;
  runningPages: string[];
}

export interface PrintLogEntry {
  id: string;
  timestamp: string;
  user_id: string;
  details: string;
  row_ids?: string[];
  [key: string]: any;
}

export interface PrintQueueItem {
  id: string;
  module: 'po' | 'sauda' | 'amad' | 'material_inspection' | 'stock';
  refNo: string;
  title: string;
  summary: string;
  timestamp: string;
  payload: any;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  user_id: string;
  finalArrivalNo: string;
  mrNo: string;
  originalState: any;
  updatedState: any;
  rawDetails: string;
}

export const TABLES: TableDef[] = [
  // Core User & System Tables
  { name: "user_master", label: "User Master", icon: User, pk: "user_id" },
  { name: "user_activity_logs", label: "User Activity Logs", icon: ClipboardList, pk: "log_id" },
  { name: "userlog_master", label: "User Log Master", icon: Terminal, pk: "id" },

  // Jute Mill ERP Tables
  { name: "batch_master", label: "Batch Master", icon: Layers, pk: "code" },
  { name: "sauda_master", label: "Sauda Master", icon: FileText, pk: "sauda_id" },
  { name: "satta_master", label: "Satta Master", icon: FileText, pk: "satta_id" },
  { name: "temporary_material_received", label: "Temporary M.R (Current)", icon: Archive, pk: "amad_id" },
  { name: "final_arrival", label: "Final M.R", icon: CheckCircle2, pk: "final_arrival_id" },
  { name: "issue_master", label: "Issue Master", icon: Layers, pk: "amad_id" },
  { name: "mill_issue_master", label: "Mill Issue Master", icon: Layers, pk: "issue_id" },
  { name: "mill_issue_detail", label: "Mill Issue Detail", icon: Layers, pk: "id" },
  { name: "godown_master", label: "Godown Master", icon: Box, pk: "id" },
  { name: "godown_wise_stock", label: "Godown Wise Stock", icon: Box, pk: "id" },
  { name: "opening_stock", label: "Opening Stock", icon: CheckCircle2, pk: "id" },
  { name: "closing_stock", label: "Closing Stock", icon: CheckCircle2, pk: "id" },
  { name: "supply_master", label: "Supply Master", icon: Users, pk: "id" },
  { name: "customer_master", label: "Customer Master", icon: Users, pk: "id" },
  { name: "broker_master", label: "Broker Master", icon: Users, pk: "id" },
  { name: "area_master", label: "Area Master", icon: MapPin, pk: "id" },
  { name: "agency_master", label: "Agency Master", icon: MapPin, pk: "id" },
  { name: "grade_master", label: "Grade Master", icon: Layers, pk: "id" },
  { name: "marka_master", label: "Marka Master", icon: Box, pk: "id" },
  { name: "purchase_master", label: "Purchase Master", icon: FileText, pk: "po_id" },
  { name: "unit_master", label: "Unit Master", icon: Layers, pk: "id" },
  { name: "lorry_weighments", label: "Lorry Weighments", icon: Scale, pk: "id" },
  { name: "deduction_master", label: "Deduction Master", icon: DollarSign, pk: "id" },
  { name: "moisture_logic", label: "Moisture Logic", icon: ClipboardList, pk: "id" },
  { name: "satta_base_rates", label: "Satta Base Rates", icon: DollarSign, pk: "id" },
  { name: "satta_differentials", label: "Satta Differentials", icon: Layers, pk: "id" },
  { name: "satta_calculated_rates", label: "Satta Calculated Rates", icon: FileText, pk: "id" },

  // Academic & Student Management Tables
  { name: "academic_year_master", label: "Academic Year Master", icon: Calendar, pk: "id" },
  { name: "account_master", label: "Account Master", icon: FileText, pk: "id" },
  { name: "admission_inquiry", label: "Admission Inquiry", icon: HelpCircle, pk: "id" },
  { name: "asset_master", label: "Asset Master", icon: Key, pk: "id" },
  { name: "asset_tagging_employee", label: "Asset Tagging Employee", icon: Briefcase, pk: "id" },
  { name: "assignments_master", label: "Assignments Master", icon: Notebook, pk: "id" },
  { name: "class_master", label: "Class Master", icon: Building, pk: "id" },
  { name: "dailywork_master", label: "Dailywork Master", icon: Notebook, pk: "id" },
  { name: "department_master", label: "Department Master", icon: Layers, pk: "dept_code" },
  { name: "designation_master", label: "Designation Master", icon: Award, pk: "desg_code" },
  { name: "division_master", label: "Division Master", icon: Layers, pk: "id" },
  { name: "document_master", label: "Document Master", icon: FileText, pk: "id" },
  { name: "driver_master", label: "Driver Master", icon: UserCheck, pk: "id" },
  { name: "employee_award", label: "Employee Award", icon: Award, pk: "id" },
  { name: "employee_bank_details", label: "Employee Bank Details", icon: DollarSign, pk: "id" },
  { name: "employee_card_details", label: "Employee Card Details", icon: Key, pk: "id" },
  { name: "employee_club", label: "Employee Club", icon: Users, pk: "id" },
  { name: "employee_document", label: "Employee Document", icon: FileText, pk: "id" },
  { name: "employee_education", label: "Employee Education", icon: GraduationCap, pk: "id" },
  { name: "employee_experience", label: "Employee Experience", icon: Briefcase, pk: "id" },
  { name: "employee_id_card", label: "Employee ID Card", icon: UserCheck, pk: "id" },
  { name: "employee_incident", label: "Employee Incident", icon: ShieldAlert, pk: "id" },
  { name: "employee_language", label: "Employee Language", icon: BookOpen, pk: "id" },
  { name: "employee_leave_opening", label: "Employee Leave Opening", icon: Calendar, pk: "id" },
  { name: "employee_master", label: "Employee Master", icon: Users, pk: "emp_code" },
  { name: "employee_performance", label: "Employee Performance", icon: Award, pk: "id" },
  { name: "employee_reference", label: "Employee Reference", icon: Users, pk: "id" },
  { name: "employee_reporting_details", label: "Employee Reporting Details", icon: Users, pk: "id" },
  { name: "employee_shift", label: "Employee Shift", icon: Calendar, pk: "id" },
  { name: "event_master", label: "Event Master", icon: Calendar, pk: "id" },
  { name: "exam_master", label: "Exam Master", icon: BookOpen, pk: "id" },
  { name: "expense_master", label: "Expense Master", icon: DollarSign, pk: "id" },
  { name: "fee_collection", label: "Fee Collection", icon: DollarSign, pk: "id" },
  { name: "fee_master", label: "Fee Master", icon: DollarSign, pk: "id" },
  { name: "holiday_master", label: "Holiday Master", icon: Calendar, pk: "id" },
  { name: "homework_master", label: "Homework Master", icon: Notebook, pk: "id" },
  { name: "hostel_master", label: "Hostel Master", icon: Building, pk: "id" },
  { name: "item_category", label: "Item Category", icon: Box, pk: "id" },
  { name: "item_master", label: "Item Master", icon: Box, pk: "id" },
  { name: "leave_application", label: "Leave Application", icon: Calendar, pk: "id" },
  { name: "leave_master", label: "Leave Master", icon: Calendar, pk: "id" },
  { name: "library_book_issue", label: "Library Book Issue", icon: BookOpen, pk: "id" },
  { name: "library_book_master", label: "Library Book Master", icon: BookOpen, pk: "id" },
  { name: "notice_board", label: "Notice Board", icon: FileText, pk: "id" },
  { name: "parent_master", label: "Parent Master", icon: Users, pk: "id" },
  { name: "route_master", label: "Route Master", icon: MapPin, pk: "id" },
  { name: "salary_structure", label: "Salary Structure", icon: DollarSign, pk: "id" },
  { name: "school_master", label: "School Master", icon: Building, pk: "id" },
  { name: "sms_log", label: "SMS Log", icon: MessageSquare, pk: "id" },
  { name: "sms_template", label: "SMS Template", icon: MessageSquare, pk: "id" },
  { name: "student_attendance", label: "Student Attendance", icon: Calendar, pk: "id" },
  { name: "student_category", label: "Student Category", icon: Users, pk: "id" },
  { name: "student_certificate", label: "Student Certificate", icon: Award, pk: "id" },
  { name: "student_document", label: "Student Document", icon: FileText, pk: "id" },
  { name: "student_enrollment", label: "Student Enrollment", icon: UserCheck, pk: "id" },
  { name: "student_house", label: "Student House", icon: Building, pk: "id" },
  { name: "student_idcard", label: "Student ID Card", icon: UserCheck, pk: "id" },
  { name: "student_master", label: "Student Master", icon: Users, pk: "student_id" },
  { name: "student_parent_mapping", label: "Student Parent Mapping", icon: Users, pk: "id" },
  { name: "student_subject_mapping", label: "Student Subject Mapping", icon: BookOpen, pk: "id" },
  { name: "subject_group", label: "Subject Group", icon: Layers, pk: "id" },
  { name: "subject_master", label: "Subject Master", icon: BookOpen, pk: "id" },
  { name: "teacher_idcard", label: "Teacher ID Card", icon: Contact, pk: "id" },
  { name: "template_master", label: "Template Master", icon: FileText, pk: "id" },
  { name: "timetable_master", label: "Timetable Master", icon: Calendar, pk: "id" },
  { name: "timetable_substitution", label: "Timetable Substitution", icon: Calendar, pk: "id" },
  { name: "vendor_master", label: "Vendor Master", icon: Users, pk: "id" },
  { name: "visitor_master", label: "Visitor Master", icon: UserCheck, pk: "id" },
  { name: "warning_letter", label: "Warning Letter", icon: ShieldAlert, pk: "id" },
  { name: "whatsapp_log", label: "WhatsApp Log", icon: MessageSquare, pk: "id" },
];

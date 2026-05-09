// Minimal hand-written Database types — replace with `supabase gen types` later.

export type UserRole = "student" | "support" | "admin";
export type CourseStatus = "draft" | "published";
export type AccessType = "free" | "paid";
export type EnrollmentSource =
  | "hotmart"
  | "kiwify"
  | "eduzz"
  | "cademi"
  | "manual"
  | "admin";
export type EnrollmentStatus = "active" | "revoked";
export type CommentStatus = "open" | "answered";
export type CertificateType = "certificate" | "recommendation";

export interface Profile {
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description_md: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  category_id: string | null;
  access_type: AccessType;
  sales_url: string | null;
  whatsapp_url: string | null;
  syllabus_md: string | null;
  signature_name: string;
  signature_role: string;
  signature_image_url: string | null;
  secondary_signature_name: string | null;
  secondary_signature_role: string | null;
  secondary_signature_image_url: string | null;
  status: CourseStatus;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  panda_video_id: string | null;
  duration_seconds: number;
  materials_url: string | null;
  sort_order: number;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  granted_at: string;
  expires_at: string | null;
  source: EnrollmentSource;
  external_order_id: string | null;
  status: EnrollmentStatus;
}

export interface LessonProgress {
  user_id: string;
  lesson_id: string;
  completed_at: string;
}

export interface CommentRow {
  id: string;
  user_id: string;
  lesson_id: string;
  body: string;
  parent_id: string | null;
  status: CommentStatus;
  answered_by: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  type: CertificateType;
  full_name_snapshot: string;
  cpf_snapshot: string;
  first_issued_at: string;
  last_issued_at: string;
  code: string;
  pdf_url: string | null;
}

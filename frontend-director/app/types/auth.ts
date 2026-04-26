export type UserRole = "director" | "manager";

export interface MangoTelephonyNumber {
  number: string;
  protocol: string | null;
  order: number | null;
  wait_sec: number | null;
  status: string | null;
}

export interface User {
  id: number;
  name: string;
  fio: string | null;
  email: string;
  role: UserRole;
  mangoUserId: number | null;
  mangoLogin?: string | null;
  mangoExtension?: string | null;
  mangoPosition?: string | null;
  mangoDepartment?: string | null;
  mangoMobile?: string | null;
  mangoOutgoingLine?: string | null;
  mangoAccessRoleId?: number | null;
  mangoGroups?: number[] | null;
  mangoSips?: string[] | null;
  mangoTelephonyNumbers?: MangoTelephonyNumber[] | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

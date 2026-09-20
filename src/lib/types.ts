/** Shared result types for Domain & SSL Report. Never invent registry dates. */

export type DaysLeft = number | null;

export type ExpirySource =
  | "rdap-expiration"
  | "tls-leaf"
  | "unavailable";

export interface DomainExpiry {
  /** ISO date string when known; null when registry withholds / lookup failed */
  date: string | null;
  /** Human phrase when date is null */
  message: string | null;
  daysLeft: DaysLeft;
  source: ExpirySource;
  warn: boolean;
}

export interface CertExpiry {
  date: string | null;
  message: string | null;
  daysLeft: DaysLeft;
  source: ExpirySource;
  warn: boolean;
}

export interface FreeLookupResult {
  domain: string;
  domainExpiry: DomainExpiry;
  certExpiry: CertExpiry;
  /** True if either expiry is within WARN_DAYS (or already past) */
  anyWarn: boolean;
  lookedUpAt: string;
}

export interface RegistrarInfo {
  name: string | null;
  ianaId: string | null;
  renewHint: string;
}

export interface TlsDetails {
  issuer: string | null;
  subject: string | null;
  notBefore: string | null;
  notAfter: string | null;
  san: string[];
  coversBare: boolean | null;
  coversWww: boolean | null;
  chainSubjects: string[];
  error: string | null;
}

export interface MailSpoofAssessment {
  spf: string | null;
  dmarc: string | null;
  mx: string[];
  risk: "high" | "medium" | "elevated" | "low" | "unknown";
  line: string;
  dkimNote: string;
}

export interface DnsSnapshot {
  nameservers: string[];
  a: string[];
  aaaa: string[];
  aWww: string[];
  mx: string[];
  txt: string[];
  caa: string[];
  hostingHint: string;
}

export interface RedirectProbe {
  url: string;
  status: number | null;
  location: string | null;
  hsts: boolean;
  error: string | null;
}

export interface RedirectMatrix {
  probes: RedirectProbe[];
  forcesHttps: boolean;
  note: string;
}

export interface PaidDomainReport {
  domain: string;
  free: FreeLookupResult;
  registrar: RegistrarInfo;
  tls: TlsDetails;
  dns: DnsSnapshot;
  mail: MailSpoofAssessment;
  redirects: RedirectMatrix;
  ownerSummary: string;
}

export interface PaidReportResponse {
  domains: PaidDomainReport[];
  ics: string;
  plainSummary: string;
  paid: boolean;
  lookedUpAt: string;
}

export interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

export interface RdapEntity {
  roles?: string[];
  handle?: string;
  vcardArray?: unknown;
  fn?: string;
  publicIds?: Array<{ type?: string; identifier?: string }>;
  entities?: RdapEntity[];
}

export interface RdapDomain {
  ldhName?: string;
  unicodeName?: string;
  status?: string[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
  nameservers?: Array<{ ldhName?: string }>;
  errorCode?: number;
  title?: string;
  description?: string[];
}

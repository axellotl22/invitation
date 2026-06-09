export interface User {
  id: string;
  email: string;
  name: string | null;
  locale: string;
}

export interface Stats {
  households: number;
  responded: number;
  pending: number;
  attending: number;
  declined: number;
  unanswered: number;
}

export interface Invitation {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  rsvpDeadline: string | null;
  imageUrl: string | null;
  isOpen: boolean;
  defaultLocale: string;
  stats?: Stats;
}

export interface Member {
  id: string;
  name: string;
  attending: boolean | null;
}

export interface Household {
  id: string;
  name: string;
  email: string | null;
  pin: string;
  rsvpStatus: 'PENDING' | 'RESPONDED';
  message: string | null;
  respondedAt: string | null;
  members: Member[];
  answers?: StoredAnswer[];
}

export interface StoredAnswer {
  questionId: string;
  memberId: string | null;
  value: string; // JSON-encoded on host endpoints
}

export type QuestionType = 'TEXT' | 'YES_NO' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';
export type QuestionScope = 'PER_HOUSEHOLD' | 'PER_MEMBER';

export interface Question {
  id: string;
  type: QuestionType;
  scope: QuestionScope;
  required: boolean;
  labelEn: string;
  labelDe: string;
  optionsEn: string; // JSON string on host endpoints
  optionsDe: string;
  sortOrder: number;
}

export interface InvitationDetail extends Invitation {
  questions: Question[];
  households: Household[];
  stats: Stats;
}

export interface DuplicatePair {
  a: DuplicateHousehold;
  b: DuplicateHousehold;
  reasons: string[];
}

export interface DuplicateHousehold {
  id: string;
  name: string;
  email: string | null;
  rsvpStatus: string;
  respondedAt: string | null;
  members: Member[];
}

// Public RSVP endpoint shapes (options/values already decoded)
export interface PublicInvitation {
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  rsvpDeadline: string | null;
  imageUrl: string | null;
  isOpen: boolean;
  defaultLocale: string;
  rsvpClosed: boolean;
}

export interface PublicQuestion {
  id: string;
  type: QuestionType;
  scope: QuestionScope;
  required: boolean;
  labelEn: string;
  labelDe: string;
  optionsEn: string[];
  optionsDe: string[];
}

export interface PublicHouseholdData {
  household: {
    id: string;
    name: string;
    rsvpStatus: 'PENDING' | 'RESPONDED';
    message: string | null;
    members: Member[];
    answers: { questionId: string; memberId: string | null; value: unknown }[];
  };
  questions: PublicQuestion[];
  rsvpClosed: boolean;
}

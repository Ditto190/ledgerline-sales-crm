import { addDays, formatISO } from "date-fns";
import { emptyEvidence } from "@/domain/evidence";
import {
  ACTIVITY_TYPES,
  AU_STATES,
  STAGES,
  type Activity,
  type Company,
  type Contact,
  type Opportunity,
  type Snapshot,
  type Stage,
} from "@/domain/types";

/** Deterministic PRNG so demo data is stable for a given day. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMPANIES: [string, string, string, (typeof AU_STATES)[number]][] = [
  ["Banksia Freight Co.", "Logistics", "Brisbane", "QLD"],
  ["Southern Cross Dental Group", "Healthcare", "Melbourne", "VIC"],
  ["Ironbark Civil Pty Ltd", "Construction", "Newcastle", "NSW"],
  ["Coral Coast Hotels", "Hospitality", "Cairns", "QLD"],
  ["Waratah Legal Partners", "Professional services", "Sydney", "NSW"],
  ["Nullarbor Mining Services", "Mining", "Kalgoorlie", "WA"],
  ["Tasman Aquaculture", "Agriculture", "Hobart", "TAS"],
  ["Riverina Grain Traders", "Agriculture", "Wagga Wagga", "NSW"],
  ["Harbourline Ferries", "Transport", "Sydney", "NSW"],
  ["Kookaburra Kids Childcare", "Education", "Adelaide", "SA"],
  ["Spinifex Solar", "Energy", "Perth", "WA"],
  ["Brindabella Software", "Technology", "Canberra", "ACT"],
  ["Outback Fleet Leasing", "Financial services", "Darwin", "NT"],
  ["Murray Valley Wines", "Food & beverage", "Mildura", "VIC"],
  ["Greenhill Aged Care", "Healthcare", "Geelong", "VIC"],
  ["Pacific Edge Surf Co.", "Retail", "Gold Coast", "QLD"],
  ["Eucalypt Architects", "Professional services", "Melbourne", "VIC"],
  ["Redgum Manufacturing", "Manufacturing", "Adelaide", "SA"],
  ["Bluewater Marine Supplies", "Retail", "Fremantle", "WA"],
  ["Gondwana University Press", "Education", "Brisbane", "QLD"],
  ["Silver Wattle Insurance", "Financial services", "Sydney", "NSW"],
  ["Kimberley Cattle Co.", "Agriculture", "Broome", "WA"],
  ["Capital Health Imaging", "Healthcare", "Canberra", "ACT"],
  ["Lyrebird Media", "Media", "Sydney", "NSW"],
  ["Apex Alpine Resorts", "Hospitality", "Thredbo", "NSW"],
];
const FIRST = [
  "Olivia",
  "Jack",
  "Charlotte",
  "Noah",
  "Mia",
  "William",
  "Amelia",
  "Oliver",
  "Isla",
  "Thomas",
  "Grace",
  "Lachlan",
  "Chloe",
  "Harrison",
  "Sienna",
  "Cooper",
  "Matilda",
  "Liam",
  "Zara",
  "Ethan",
  "Priya",
  "Wei",
  "Aroha",
  "Mehmet",
  "Sofia",
  "Darcy",
  "Ngaio",
  "Raj",
  "Hannah",
  "Tom",
];
const LAST = [
  "Nguyen",
  "Smith",
  "Williams",
  "Brown",
  "Wilson",
  "Taylor",
  "Anderson",
  "Thompson",
  "Patel",
  "Kelly",
  "O'Brien",
  "Martin",
  "Chen",
  "Walker",
  "Murphy",
  "Singh",
  "Harris",
  "Ryan",
  "Robinson",
  "Clarke",
  "Kaur",
  "Russo",
  "Papadopoulos",
  "Wright",
  "Hughes",
];
const TITLES = [
  "Operations Manager",
  "Chief Financial Officer",
  "Procurement Lead",
  "Managing Director",
  "IT Manager",
  "Practice Manager",
  "Head of Sales",
  "General Manager",
  "Facilities Coordinator",
  "Chief Executive Officer",
];
const PRODUCTS = [
  "Fleet telematics rollout",
  "CRM licence renewal",
  "Network upgrade",
  "Managed services agreement",
  "Field service app",
  "Data platform migration",
  "Security audit",
  "Payroll integration",
  "Customer portal",
  "Annual support contract",
  "Warehouse scanners",
  "Analytics pilot",
];
const SUBJECTS: Record<string, string[]> = {
  call: ["Discovery call", "Follow-up on proposal", "Pricing discussion", "Check-in call"],
  email: [
    "Send revised quote",
    "Share case study",
    "Confirm meeting agenda",
    "Send contract draft",
  ],
  meeting: ["On-site demo", "Steering committee", "Technical workshop", "Commercial review"],
  task: ["Prepare proposal", "Update forecast", "Request reference", "Draft statement of work"],
};
const OWNERS = [
  { id: "u_ava", name: "Ava Mitchell" },
  { id: "u_ben", name: "Ben Okafor" },
  { id: "u_cleo", name: "Cleo Tran" },
  { id: "u_dan", name: "Dan Fitzgerald" },
];

export function createSeed(today: Date): Snapshot {
  const rand = mulberry32(today.getFullYear() * 1000 + today.getMonth() * 40 + today.getDate());
  const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)] as T;
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const day = (offset: number) => formatISO(addDays(today, offset));
  const date = (offset: number) => formatISO(addDays(today, offset), { representation: "date" });

  const companies: Company[] = COMPANIES.map(([name, industry, city, state], i) => ({
    id: `co_${i + 1}`,
    name,
    industry,
    city,
    state,
    website: `www.${name.toLowerCase().replace(/[^a-z]+/g, "")}.com.au`,
    phone: `(0${int(2, 8)}) ${int(3000, 9999)} ${int(1000, 9999)}`,
    employees: int(12, 2400),
    ownerId: OWNERS[i % OWNERS.length]!.id,
    createdAt: day(-int(200, 700)),
  }));

  const contacts: Contact[] = Array.from({ length: 60 }, (_, i) => {
    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    const co = companies[i % companies.length]!;
    return {
      id: `ct_${i + 1}`,
      firstName,
      lastName,
      jobTitle: pick(TITLES),
      email:
        `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "") +
        "@" +
        co.website.slice(4),
      phone: `04${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
      companyId: co.id,
      createdAt: day(-int(30, 500)),
    };
  });

  const stageWeights: Stage[] = [
    "qualify",
    "qualify",
    "develop",
    "develop",
    "develop",
    "propose",
    "propose",
    "negotiate",
    "won",
    "won",
    "lost",
  ];
  const opportunities: Opportunity[] = Array.from({ length: 45 }, (_, i) => {
    const co = companies[int(0, companies.length - 1)]!;
    const coContacts = contacts.filter((c) => c.companyId === co.id);
    const stage = pick(stageWeights);
    const open = stage !== "won" && stage !== "lost";
    const created = -int(20, 300);
    const closedOffset = open ? 0 : int(created + 5, -1);
    return {
      id: `op_${i + 1}`,
      name: `${co.name.split(" ")[0]} – ${pick(PRODUCTS)}`,
      companyId: co.id,
      contactIds: coContacts.slice(0, int(1, Math.min(2, coContacts.length))).map((c) => c.id),
      ownerId: pick(OWNERS).id,
      value: int(8, 480) * 1000,
      stage,
      probability: open && rand() < 0.15 ? int(5, 95) : null,
      expectedClose: date(open ? int(-10, 150) : closedOffset),
      closeReason:
        stage === "won"
          ? "Best fit on price and support"
          : stage === "lost"
            ? pick(["Lost on price", "Went with incumbent", "Project deferred"])
            : null,
      createdAt: day(created),
      closedAt: open ? null : day(closedOffset),
    };
  });

  const activities: Activity[] = Array.from({ length: 150 }, (_, i) => {
    const o = opportunities[i % opportunities.length]!;
    const type = pick(ACTIVITY_TYPES);
    const offset = int(-60, 30);
    const completed = offset < -2 ? rand() < 0.8 : offset < 0 ? rand() < 0.4 : false;
    const staleOpp = i % opportunities.length < 6; // keep a few deals quiet
    const due = staleOpp && completed ? offset - 40 : offset;
    return {
      id: `ac_${i + 1}`,
      type,
      subject: pick(SUBJECTS[type]!),
      notes: "",
      dueDate: date(due),
      completed,
      completedAt: completed ? day(due) : null,
      opportunityId: o.id,
      contactId: o.contactIds[0] ?? null,
      companyId: o.companyId,
      ownerId: o.ownerId,
      createdAt: day(due - 7),
    };
  });

  return {
    evidence: emptyEvidence(),
    companies,
    contacts,
    opportunities,
    activities,
    settings: {
      dateFormat: "dd/MM/yyyy",
      staleDays: 21,
      stageProbabilities: Object.fromEntries(
        STAGES.map((s) => [
          s,
          { qualify: 10, develop: 30, propose: 55, negotiate: 80, won: 100, lost: 0 }[s],
        ]),
      ) as Snapshot["settings"]["stageProbabilities"],
      owners: OWNERS,
    },
  };
}

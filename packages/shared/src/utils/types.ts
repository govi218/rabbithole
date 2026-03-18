export type TrailWalkStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";

export interface Settings {
  alignment: "left" | "right";
  show: boolean;
  darkMode: boolean;
  hasSeenOnboarding: boolean;
}

export interface Website {
  url: string;
  name: string;
  savedAt: number;
  faviconUrl: string;
  openGraphImageUrl?: string;
  description?: string;
  alreadySaved?: boolean;
}

export interface Burrow {
  id: string;
  createdAt: number;
  websites: string[]; // urls
  name: string;
  sembleCollectionUri?: string;
  lastSembleSync?: number;
}

export interface TrailStop {
  websiteUrl: string;
  note: string;
}

export interface Trail {
  id: string;
  createdAt: number;
  name: string;
  rabbitholeId: string;
  stops: TrailStop[];
  startNote: string;
  endNote?: string;
  sidetrailUri?: string;
  sidetrailCid?: string;
}

export interface TrailWalk {
  id: string;
  trailId: string;
  visitedStops: string[];
  createdAt: number;
  updatedAt: number;
  completed: boolean;
  status: TrailWalkStatus;
  sidetrailWalkUri?: string;
}

export interface TrailWalkState {
  trail: Trail | null;
  walk: TrailWalk | null;
  websites: Website[];
}

export interface Rabbithole {
  id: string;
  createdAt: number;
  burrows: string[]; // burrow IDs
  trails?: string[]; // trail IDs
  title: string;
  description?: string;
  meta: string[]; // urls
  activeTabs?: string[];
}

export interface User {
  id: string;
  currentRabbithole: string;
  currentBurrow: string;
  currentTrail?: string;
  settings: Settings;
}

export interface ATProtoSession {
  did: string;
  handle: string;
  pdsUrl: string;
  accessToken: string;
  tokenEndpoint: string;
  refreshToken?: string;
}

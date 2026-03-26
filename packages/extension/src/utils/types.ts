export enum MessageRequest {
  SAVE_TAB,
  GET_ALL_ITEMS,
  GET_SETTINGS,
  UPDATE_SETTINGS,
  GET_ALL_BURROWS,
  GET_BURROW_WEBSITES,
  CREATE_NEW_BURROW,
  CHANGE_ACTIVE_BURROW,
  GET_ACTIVE_BURROW,
  GET_BURROW,
  SAVE_WINDOW_TO_NEW_BURROW,
  SAVE_WINDOW_TO_ACTIVE_BURROW,
  SAVE_WINDOW_TO_RABBITHOLE,
  RENAME_BURROW,
  DELETE_BURROW,
  DELETE_WEBSITE,
  PUBLISH_BURROW,
  PUBLISH_TRAIL,
  SYNC_ATPROTO,
  GET_ACTIVE_RABBITHOLE,
  CHANGE_ACTIVE_RABBITHOLE,
  CREATE_NEW_RABBITHOLE,
  UPDATE_RABBITHOLE,
  DELETE_RABBITHOLE,
  UPDATE_RABBITHOLE_PINNED_WEBSITES,
  ADD_BURROWS_TO_RABBITHOLE,
  CREATE_NEW_BURROW_IN_RABBITHOLE,
  ADD_WEBSITES_TO_RABBITHOLE_META,
  ADD_WEBSITES_TO_BURROW,
  DELETE_WEBSITE_FROM_RABBITHOLE_META,
  GET_ALL_RABBITHOLES,
  FETCH_RABBITHOLE_FOR_BURROW,
  UPDATE_WEBSITE,
  SYNC_BURROW,
  OPEN_TABS,
  REMOVE_FROM_ACTIVE_TABS,
  IMPORT_DATA,
  GET_RABBITHOLE_WEBSITES,
  CREATE_TRAIL,
  GET_TRAIL,
  GET_ALL_TRAILS,
  UPDATE_TRAIL,
  DELETE_TRAIL,
  CHANGE_ACTIVE_TRAIL,
  GET_ACTIVE_TRAIL,
  START_TRAIL_WALK,
  ADVANCE_TRAIL_WALK,
  REWIND_TRAIL_WALK,
  COMPLETE_TRAIL_WALK,
  ABANDON_TRAIL_WALK,
  GET_TRAIL_WALK_STATE,
  GET_TRAIL_WALK_TAB,
  FOCUS_TRAIL_TAB,
  GET_CURRENT_TAB_ID,
  REGISTER_TRAIL_WALK_TAB,
  IMPORT_BROWSER_DATA,
  IMPORT_TRAIL_FROM_EXPLORE,
}

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
  tid: string;           // unique stop ID
  title: string;         // stop title (required)
  websiteUrl: string;
  note: string;
  buttonText?: string;   // default "Next"
}

export interface Trail {
  id: string;
  createdAt: number;
  name: string;
  rabbitholeId: string;
  stops: TrailStop[];
  startNote: string;
  description?: string;  // trail description
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

/*global chrome*/
import { init_user, update_last_opened, update_active_website, update_active_tab, get_user } from './db_methods';

export function create_id() {
  return Math.random().toString(36).substr(2, 10);
};

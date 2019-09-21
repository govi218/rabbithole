import Dexie from 'dexie';

const db = new Dexie('rabbitholeDB');
db.version(1).stores({
    user: `user_id, active_tab, active_window, active_rabbithole, last_opened`,
    websites: `website_id, &url, from_websites, to_websites, notes, *tags`,
    rabbitholes: `rabbithole_id, websites, rabbithole_name, last_active_window` // might need tags here as well
});

export default db;
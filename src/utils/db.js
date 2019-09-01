import Dexie from 'dexie';

const db = new Dexie('myDb');
db.version(1).stores({
    user: `user_id`,
    websites: `website_id, &url, from_websites, to_websites, notes, *tags`,
    rabbitholes: `rabbithole_id, websites, rabbithole_name` // might need tags here as well
});

export default db;
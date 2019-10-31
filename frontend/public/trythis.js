import Dexie from 'dexie';

const db = new Dexie('rabbitholeDB');

db.version(1).stores({
    user: `&user_id, active_tab, active_window, active_rabbithole, last_opened`,
    // websites: `&website_id, &url, from_websites, to_websites, notes, *tags`, // no reason for this to be at the user level
    rabbitholes: `&rabbithole_id, rabbithole_name, website_list, last_active_window` // might need tags here as well
});

/**
 * Read operation
 * 
 * Gets the all rabbitholes from the db.
 */
export async function get_all_rabbitholes() {
    let rabbitholes = await db.rabbitholes.toArray();
    return rabbitholes;
}

export function uploadRabbitHoles() {

    // Create a new XMLHttpRequest
    const xhr = new XMLHttpRequest()
    const url = 'http://localhost:8080'

    // Initialize a POST request on specified URL.
    xhr.open('POST', url);
    console.log('background script')
    // Send POST request once rabbitholes have been loaded.
    get_all_rabbitholes().then(
        (rh) => {
            xhr.send(JSON.stringify(rh[0]))
            console.log('Sent!')
            console.log(rh[0])
        });
}


export default db;
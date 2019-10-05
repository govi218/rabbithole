/*global chrome*/

// instantiate IndexedDB
import db from './db';
import { create_id } from './lib';

/**
 * Read/Write operation
 * 
 * Queries DB for user, if not creates a new user.
 * n.b. This is wrapped in a Promise because it needs to block
 *      execution in App.js lest the rendering continues before
 *      this is done.
 */
export async function init_user() {
  // returns a promise to guarantee it will send something
  return new Promise(resolve => {
    // check if ID exists
    get_user()
      .then((user) => {
        // if the user exists, update last opened and resolve
        if (user[0].user_id !== '') {
          update_last_opened(Date.now()); /// don't really care if this is async
          // resolve with 0 to indicate not first time
          resolve(0);
          return;
        } else {
          /// not sure if Dexie will return an undefined user obj
          console.log('???'); // need to check if this gets triggered with tests
        }
      })
      // user doesn't exist
      .catch(async (err) => {
        // instantiate user
        let id = create_id();
        await db.user.put({
          user_id: id,
          active_tab: '',
          active_window: '',
          active_rabbithole: '',
          active_website: '',
          last_opened: Date.now()
        });
        // resolve with 0 to indicate first time
        resolve(1);
      });
  });
}

/**
 * Read operation
 * 
 * Returns the user in an array (can be accessed by user[0], Dexie quirk).
 */
export async function get_user() {
  let user = await db.user.toArray();
  return user;
}

/**
 * Read operation
 * 
 * Returns the user in an array (can be accessed by active-rabbithole[0], Dexie quirk).
 */
export async function get_active_rabbithole() {
  let user = await get_user();
  console.log(user);
  if (user.length === 0) return {};
  let active_rabbithole = await get_rabbithole_with_id(user[0].active_rabbithole);
  console.log(active_rabbithole);
  return active_rabbithole;
}

/**
 * Read operation
 * 
 * Gets the website object for a given URL
 * @param {string} url URL of website to retrieve
 */
export async function get_website_with_url(url) {
  let website = await db.websites.where('url').equals(url).toArray();
  return website;
}

/**
 * Read operation
 * 
 * Gets the Rabbithole object for a given rabbithole_id
 * @param {string} id ID of the Rabbithole to retrieve 
 */
export async function get_rabbithole_with_id(id) {
  let rabbithole = await db.rabbitholes.where('rabbithole_id').equals(id).toArray();
  return rabbithole;
}

/**
 * Read operation
 * 
 * Gets the all rabbitholes from the db.
 */
export async function get_all_rabbitholes() {
  let rabbitholes = await db.rabbitholes.toArray();
  return rabbitholes;
}

/**
 * Update operation
 * 
 * Updates the current active website.
 * @param {Object} rabbithole_id rabbithole_id of the current active website
 */
export async function update_active_rabbithole(rabbithole_id) {
  get_user()
    .then(async (user) => {
      let id = user[0].user_id;
      await db.user.update(id, { active_rabbithole: rabbithole_id });
    })
    .catch(err => console.log(err));
}

/**
 * Update operation
 * 
 * Updates the last time the website was opened.
 * @param {Object} timestamp timestamp of the most recent open
 */
export async function update_last_opened(timestamp) {
  get_user()
    .then(async (user) => {
      let id = user[0].user_id;
      await db.user.update(id, { last_opened: timestamp })
    });
}

/**
 * Update operation
 * 
 * Updates the state of Rabbitholes in the IndexedDB with data collected
 * in chrome.storage from the background page.
 * 
 * @param {Array} rabbitholes JSONArray of rabbitholes. The data format
 *   is as described in background.js
 */
export async function update_rabbitholes(rabbitholes) {
  // no new rabbitholes
  if (rabbitholes === [] || rabbitholes === undefined) return;

  for (let i = 0; i < rabbitholes.length; i++) {
    // case 1: no new changes, do nothing
    if (rabbitholes[i].website_list === undefined) continue;

    // query indexedDB for rabbithole
    let db_rabbithole = await get_rabbithole_with_id(rabbitholes[i].rabbithole_id);

    // case 2: no rabbithole in DB, create it
    if (db_rabbithole[0] === {} || db_rabbithole[0] === undefined) {
      await db.rabbitholes.put({
        rabbithole_id: rabbitholes[i].rabbithole_id,
        website_list: rabbitholes[i].website_list
      });
    } else {
      // case 3: rabbithole exists and has websites

      /// failsafe, this needs to be tested
      if (db_rabbithole[0].website_list !== [] || db_rabbithole[0].website_list !== undefined) {
        for (let k = 0; k < rabbitholes[i].website_list.length; k++) {
          let found = false;
          for (let j = 0; j < db_rabbithole[0].website_list.length; j++) {
            // if it's the same website, combine their tos
            if (db_rabbithole[0].website_list[j].url === rabbitholes[i].website_list[k].url) {
              found = true;
              if (db_rabbithole[0].website_list[j].tos === undefined) db_rabbithole[0].website_list[j].tos = [];
              /// this needs to be deduped in a smart way
              db_rabbithole[0].website_list[j].tos.concat(rabbitholes[i].website_list[k].tos);
            }
          }
          // if the website wasn't found in the existing list, create it
          if (!found) db_rabbithole[0].website_list.push(rabbitholes[i].website_list[k]);
        }
        // add the updated website list
        await db.rabbitholes.put(db_rabbithole[0]);
      } else {
        console.log('no website list found for website already in DB!');
      }
    }
  }
}

/**
 * Join operation
 * 
 * Merges two rabbitholes into one and stores it into the IndexedDB.
 * Originals are deleted. (NOT TESTED)
 * 
 * @param {Object} rabbithole1_id rabbithole_id of first rabbithole
 * @param {Object} rabbithole2_id rabbithole_id of second rabbithole
 */
export async function merge_rabbitholes(rabbithole1_id, rabbithole2_id) {
  get_rabbithole_with_id(rabbithole1_id)
    .then(rabbithole1 => {
      get_rabbithole_with_id(rabbithole2_id)
        .then(async rabbithole2 => {
          let merged_rabbithole_websites = rabbithole1.websites.map(w => {
            rabbithole2.website_list.forEach(w2 => {
              if (w2.website_id === w.website_id) {
                w.to_websites.concat(w2.tos);
                w.from_websites.concat(w2.froms);
              }
            });
          });
          await db.rabbitholes.put({
            rabbithole_id: create_id(),
            wesbites: merged_rabbithole_websites
          });
          await db.rabbithole
            .where("rabbithole_id").anyOf(rabbithole1_id, rabbithole2_id)
            .delete();
        })
        .catch(err => console.log(err));
    })
}
/*global chrome*/

import db from './db';
import { create_id } from './lib';

export async function init_user() {
  return new Promise(resolve => {
    // check if ID exists
    get_user()
      .then((user) => {
        if (user[0].user_id !== '') {
          update_last_opened(Date.now()); // don't really care if this is async
          resolve(0);
          return;
        } else {
          console.log('???'); // need to check if this gets triggered with tests
        }
      })
      // user doesn't exist
      .catch(async (err) => {
        let id = create_id();
        await db.user.put({
          user_id: id,
          active_tab: '',
          active_window: '',
          active_rabbithole: '',
          active_website: '',
          last_opened: Date.now()
        });
        resolve(1);
      });
  });
}

export async function get_user() {
  let user = await db.user.toArray();
  return user;
}

export async function get_website_with_url(url) {
  let website = await db.websites.where('url').equals(url).toArray();
  return website;
}

export async function get_website_with_id(id) {
  let website = await db.websites.where('website_id').equals(id).toArray();
  return website;
}

export async function get_rabbithole_with_id(id) {
  let rabbithole = await db.rabbitholes.where('rabbithole_id').equals(id).toArray();
  return rabbithole;
}

export async function update_active_website(website) {
  get_user()
    .then(async (user) => {
      let id = user[0].user_id;
      console.log(website);
      await db.user.update(id, { active_website: website })
    });
}

export async function update_active_rabbithole(rabbithole) {
  get_user()
    .then(async (user) => {
      console.log(rabbithole);
      let id = user[0].user_id;
      await db.user.update(id, { active_rabbithole: rabbithole });
    })
    .catch(err => console.log(err));
}

export async function update_active_tab(website) {
  get_user()
    .then(async (user) => {
      let id = user[0].user_id;
      console.log(website);
      await db.user.update(id, { active_tab: website })
    });
}

export async function update_last_opened(timestamp) {
  get_user()
    .then(async (user) => {
      let id = user[0].user_id;
      await db.user.update(id, { last_opened: timestamp })
    });
}

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

export function update_websites(websites) {

  // no new websites
  if (websites === []) return;

  websites.forEach(website => {
    get_website_with_url(website.url)
      .then(async db_website => {
        if (db_website.website_id !== '') {
          db_website.to_websites.concat(website.tos);
          db_website.from_websites.concat(website.froms);
          await db.websites.update(db_website.website_id, db_website);
          return;
        } else {
          console.log('???'); // need to check if this gets triggered with tests
        }
      })
      // website doesn't exist
      .catch(async (err) => {
        await db.websites.put({
          website_id: create_id(),
          url: website.url,
          title: website.title,
          last_visited: website.last_visited,
          to_websites: website.tos,
          from_websites: website.froms
        });
      })
  });
}

/**
 * @returns 
 */
export async function get_websites() {
  let websites = await db.websites.toArray();
  return websites;
}

/**
 * @returns 
 */
export async function get_active_rabbithole() {
  let user = await get_user();
  console.log(user);
  if (user.length === 0) return {};
  let active_rabbithole = await get_rabbithole_with_id(user[0].active_rabbithole);
  console.log(active_rabbithole);
  return active_rabbithole;
}

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
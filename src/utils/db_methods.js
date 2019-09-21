/*global chrome*/

import db from './db';
import { create_id } from './lib';

export async function init_user() {
  // check if ID exists
  get_user()
    .then((user) => {
      if (user[0].user_id !== '') {
        return;
      } else {
        console.log('???'); // need to check if this gets triggered with tests
      }
    })
    // user doesn't exist
    .catch(async (err) => {
      let id = create_id();
      console.log(id);
      await db.user.put({ 
        user_id: id,
        active_tab: '',
        active_window: '',
        active_rabbithole: '',
        active_website: '',
        last_opened: Date.now()
      });
    });
}

export async function get_user() {
  let user = await db.user.toArray();
  return user;
}

// Create a new website. Necessarily needs from website.
export async function create_website(url, from_website) {
  get_website_with_url(url)
    .then((website) => {
      if (website.website_id !== '') {
        console.log(website);
        return;
      } else {
        console.log('???'); // need to check if this gets triggered with tests
      }
    })
    // website doesn't exist
    .catch( async (err) => {
      let from_websites = [];
      from_websites.push(from_website);

      await db.websites.put({
        website_id: create_id(),
        url: url,
        to_websites: [],
        from_websites: from_websites
      });
    })
}

export async function get_website_with_url(url) {
  let website =  await db.websites.where('url').equals(url).toArray();
  return website;
}

export async function update_active_website(website) {
  get_user()
    .then(async (user) => {
      let id = user[0].user_id;
      console.log(website);
      await db.user.update(id, { active_website: website })
    });
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

export function update_websites(websites) {

  // no new websites
  if (websites === []) return;

  websites.forEach(website => {
    get_website_with_url(website.url)
      .then(async (db_website) => {
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
      .catch( async (err) => {
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
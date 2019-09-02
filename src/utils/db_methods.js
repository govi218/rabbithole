import db from './db';
import { create_id } from './lib';
import { async } from 'q';

export async function init_user() {
  // check if ID exists
  get_user()
    .then((user) => {
      if (user[0].user_id !== '') {
        console.log(user[0]);
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
  let website =  await db.websites.where('url').equals(url)
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
import db from './db';
import { create_id } from './lib';
import { async } from 'q';

export async function init_user() {
  // check if ID exists
  get_user()
    .then((user) => {
      if (user[0].user_id !== '') {
        console.log(user[0].user_id);
        return;
      } else {
        console.log('???');
      }
    })
    .catch(async (err) => {
      let id = create_id();
      console.log(id);
      await db.user.put({ user_id: id });
    });
}

export async function get_user() {
  let user = await db.user.toArray();
  return user[0].user_id;
}

// export async function create_website(url, from_website) {

//   await db.websites.put({
//     website_id: create_id(),
//     url: url,
//     to_websites: [],
//     from_website: from_website
//   })
// }

// export async function get_website_with_url(url) {
//   let website =  await db.websites.where('url').equals
// }

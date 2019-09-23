/**
 * This document maintains the background state of Rabbithole.
 * 
 * It looks like this:
 * {
 *   active_rabbithole: <RABBITHOLE_ID>,
 *   active_website: <ACTIVE_WEBSITE_URL>,
 *   active_website_last_visit: <TIMESTAMP>,
 *   active_website_title: <ACTIVE_WEBSITE_TITLE>,
 *   bindings: [{
 *     rabbithole_id: <RABBITHOLE_ID>,
 *     window: <WINDOW_ID>
 *   }, ...],
 *   rabbitholes: [{
 *     rabbithole_id: <RABBITHOLE_ID>,
 *     website_list: [{
 *       url: <WEBSITE_URL>,
 *       title: <WEBSITE_TITLE>,
 *       last_visited: <TIMESTAMP>,
 *       tos: <LIST_OF_URLS>
 *     }, ...]
 *   }, ...]
 * }
 * 
 * N.B. Atomicity is yet to be implemented, 
 * ref: https://stackoverflow.com/questions/15050861/best-way-to-prevent-race-condition-in-multiple-chrome-storage-api-calls
 */


/**
 * Listener for browser window focus changes. This is always the first event 
 * to be triggered (as far as Rabbitholes are concerned).
 * 
 */
chrome.windows.onFocusChanged.addListener(function (window_id) {

  // if it's not a standard window, ignore
  if (window_id === -1) return;

  // get the user obj
  chrome.storage.local.get({ user: {} }, function (data) {

    let user_obj = data.user;
    let rabbithole_id = '';

    // if first time, create rabbitholes and bindings
    if (user_obj === {} || user_obj.rabbitholes === undefined) {
      user_obj.rabbitholes = [];
      user_obj.bindings = [];
    }

    // find the rabbithole ID
    let current_rabbithole_idx = get_rabbithole_with_window_id(user_obj.rabbitholes, window_id);

    // if there's no rabbithole associated with the current window, create one
    if (current_rabbithole_idx === -1) {
      rabbithole_id = create_id();
      
      // update bindings and create a new rabbithole
      user_obj.bindings.push({
        window_id: window_id,
        rabbithole_id: rabbithole_id
      });
      // get the active tab on this window (because tab change event isn't auto-trigerred)
      chrome.tabs.getCurrent(function(tab) {
        let website_list = [];
        website_list.push({
          url: tab.url,
          title: tab.title,
          last_visited: Date.now()
        });
        user_obj.rabbitholes.push({ 
          rabbithole_id: rabbithole_id,
          website_list: website_list
        });
      });
    } else {
      rabbithole_id = user_obj.rabbitholes[current_rabbithole_idx].rabbithole_id;

      // set active rabbithole
      user_obj.active_rabbithole = rabbithole_id;
      chrome.storage.local.set({ user: user_obj });
    }
  });
});


/**
 * Listener for new history events. Should update the current rabbithole.
 * Has fallbacks for creating rabbitholes/rabbithole-browser window bindings
 */
chrome.history.onVisited.addListener(async function (history) {

  // Ignore browser pages. Might need to handle the new tab page separately.
  let url = history.url;
  if (url.indexOf('chrome://') > -1 || url.indexOf('brave://') > -1) return;

  console.log(history); // does this have url?

  // first, get user
  chrome.storage.local.get({ user: {} }, function (data) {
    console.log('hist added');
    let user_obj = data.user;
    console.log(user_obj);

    // if first time, set active website, last visited, title
    if (user_obj === {}) {
      console.log('user first time')
      console.log(user_obj);
      user_obj.active_website = history.url;
      user_obj.lastVisited = history.lastVisitTime;
      user_obj.title = history.title;

      chrome.storage.local.set({ user: user_obj }, function (result) {
        // if no user, no website store; create it

        // add website to website list
        let website_list = [];

        let new_website = {
          url: result.url,
          title: history.title,
          last_visited: history.lastVisitTime,
          tos: [],
          froms: []
        };
        website_list.push(new_website);
        chrome.windows.getCurrent(function (window) {
          let rabbithole_id = create_id();

          user_obj.rabbitholes = [];

          // update active website
          user_obj.rabbitholes.push({
            window_id: window.id,
            rabbithole: rabbithole_id,
            website_list: website_list
          });

          // set active rabbithole
          user_obj.active_rabbithole = rabbithole_id;

          chrome.storage.local.set({ user: user_obj });
        });
      });

    } else {
      let active_website = user_obj.active_website;
      let active_website_title = user_obj.active_website_title;
      let active_website_last_visit = user_obj.active_website_last_visit;

      // no loops
      if (active_website === history.url) return;

      // load bindings, or create them if none exist
      chrome.windows.getCurrent(function (window) {

        if (user_obj.rabbitholes === undefined) user_obj.rabbitholes = [];

        let current_rabbithole_idx = get_rabbithole_with_window_id(user_obj.rabbitholes, window.id);

        if (current_rabbithole_idx === -1) {

          if (user_obj.bindings === [] || user_obj.bindings === undefined) {
            let rabbithole_id = create_id();

            user_obj.rabbitholes = [];
            user_obj.bindings = [];

            // update active website
            user_obj.rabbitholes.push({
              window_id: window.id,
              rabbithole: rabbithole_id
            });

            user_obj.bindings.push({
              window_id: window.id,
              rabbithole: rabbithole_id
            });

            // set active rabbithole
            user_obj.active_rabbithole = rabbithole_id;
            current_rabbithole_idx = user_obj.rabbitholes.length - 1;
          } else {
            if (user_obj.rabbitholes === undefined) user_obj.rabbitholes = [];
            bindings.forEach(binding => {
              user_obj.rabbitholes.push({
                window_id: binding.window_id,
                rabbithole: binding.rabbithole_id
              });
            });
          }
        }

        let website_list = user_obj.rabbitholes[current_rabbithole_idx].website_list;
        if (website_list === undefined) website_list = [];

        let to_flag = 0, from_flag = 1;

        for (let i = 0; i < website_list.length; i++) {
          if (website_list[i].url === active_website) {
            let tos = [];

            // update old active website tos
            if (website_list[i].tos === undefined) {
              tos.push(history.url);
              website_list[i].tos = tos;
            } else {
              website_list[i].tos.push(history.url);
            }
            to_flag += 1;
          } else if (website_list[i].url === history.url) {
            let froms = [];

            // update old active website tos
            if (website_list[i].tos === undefined) {
              froms.push(history.url);
              website_list[i].froms = froms;
            } else {
              website_list[i].froms.push(history.url);
            }
            from_flag += 1;
          }
        }

        if (to_flag === 0) {
          let tos = [];
          tos.push(history.url);
          let new_website = {
            url: active_website,
            title: active_website_title,
            last_visited: active_website_last_visit,
            tos: tos,
            froms: []
          };
          website_list.push(new_website);
        }

        if (from_flag === 0) {
          let froms = [];
          froms.push(active_website);
          let new_website = {
            url: history.url,
            title: history.title,
            last_visited: history.lastVisitTime,
            tos: [],
            froms: froms
          };
          website_list.push(new_website);
        }

        // replace website list in rabbithole
        user_obj.rabbitholes[current_rabbithole_idx].website_list = website_list;

        // update active website
        user_obj.active_website = history.url;
        user_obj.active_website_title = history.title;
        user_obj.active_website_last_visit = history.lastVisitTime;
        chrome.storage.local.set({ user: user_obj });
      });
    }
  });
});

chrome.tabs.onActivated.addListener(function (tab_obj) {
  chrome.tabs.get(tab_obj.tabId, function (tab) {
    // Ignore browser pages. Might need to handle the new tab page separately.
    let url = tab.url;
    if (url.indexOf('chrome://') > -1 || url.indexOf('brave://') > -1) return;
    chrome.storage.local.get({ user: {} }, function (data) {
      console.log('tab activate');
      let user_obj = data.user;

      // if first time, set active website
      if (user_obj === {}) {
        user_obj.active_website = tab.url;
        chrome.storage.local.set({ user: user_obj });

      } else {
        // update active website
        user_obj.active_website = tab.url;
        chrome.storage.local.set({ user: user_obj });
      }
    });
  })
});

chrome.windows.onCreated.addListener(function (window) {
  // if it's not a standard window, ignore
  if (window.id === -1) return;
  chrome.storage.local.get({ user: {} }, function (data) {
    console.log('window created');
    let user_obj = data.user;
    let rabbithole_id = create_id();

    // if first time, create rabbithole map
    if (user_obj === {} || user_obj.rabbitholes === undefined) user_obj.rabbitholes = [];

    // update active website
    user_obj.rabbitholes.push({
      window_id: window.id,
      rabbithole: rabbithole_id
    });

    // set active rabbithole
    user_obj.active_rabbithole = rabbithole_id;

    chrome.storage.local.set({ user: user_obj });
  });
});

/* Pure functions */

function create_id() {
  return Math.random().toString(36).substr(2, 10);
};

function get_rabbithole_with_window_id(bindings, id) {
  for (let i = 0; i < bindings.length; i++) {
    if (bindings[i].window === id) return i;
  }
  return -1;
}
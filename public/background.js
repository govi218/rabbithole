/**
 * This document maintains the background state of Rabbithole.
 * 
 * It looks like this:
 * {
 *   active_rabbithole_id: <RABBITHOLE_ID>,
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
 * to be triggered (as far as Rabbitholes are concerned). This event also handles
 * browser window creation events.
 * For e.g. when a user switches between Chrome windows or a user installs Rabbithole 
 * and performs an action on chrome (even if they have just one window open AND they 
 * perform another event);
 * 
 * Checks if the window has an existing Rabbithole bound to it, if not creates one
 * and binds it. Regardless of there being an existing binding, it will update all
 * the user's active info to this window.
 * 
 * Will do nothing if the active rabbithole matches the window's rabbithole.
 */
chrome.windows.onFocusChanged.addListener(function (window_id) {

  console.log('Window focus change');

  // if it's not a standard window, ignore
  if (window_id === -1) return;

  // get the user obj
  chrome.storage.local.get({ user: {} }, function (data) {

    let user_obj = data.user;
    let rabbithole_id = '';

    // if first time, create rabbitholes and bindings
    if (user_obj === {} || user_obj.rabbitholes === undefined || user_obj.active_rabbithole_id === undefined) {
      user_obj.rabbitholes = [];
      user_obj.bindings = [];
    }

    // find the rabbithole ID
    let current_rabbithole_idx = get_rabbithole_with_window_id(user_obj, window_id);
    let created_flag = 0;

    // if there's no rabbithole associated with the current window, create one
    if (current_rabbithole_idx === -1) {
      rabbithole_id = create_id();

      // update bindings and create a new rabbithole
      user_obj.bindings.push({
        window: window_id,
        rabbithole_id: rabbithole_id
      });

      created_flag = 1;
    } else if (current_rabbithole_idx === -2) {
      // rabbithole was flushed by IndexedDB, repopulate
      for (let i = 0; i < user_obj.bindings.length; i++) {
        if (user_obj.bindings[i].window === window_id) rabbithole_id = user_obj.bindings[i].rabbithole_id;
      }
      created_flag = 1;
    } else {
      rabbithole_id = user_obj.rabbitholes[current_rabbithole_idx].rabbithole_id;
      if (rabbithole_id === user_obj.active_rabbithole_id) return;
    }

    // get the active tab on this window (because tab change event isn't auto-trigerred)
    /// n.b. only this query consistently returns url for some reason
    chrome.tabs.query({ active: true }, function (tabs) {
      // find the active tab for this window
      let tab;
      for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].windowId === window_id) tab = tabs[i];
      }
      /// could query history here, but this should server the purpose
      let now = Date.now();
      let website_list = [];
      if (created_flag === 1) {
        website_list.push({
          url: tab.url,
          title: tab.title,
          last_visited: now
        });

        // update rabbithole
        user_obj.rabbitholes.push({
          rabbithole_id: rabbithole_id,
          website_list: website_list
        });
      }

      // update user state
      user_obj.active_rabbithole_id = rabbithole_id;
      user_obj.active_website = tab.url;
      user_obj.active_website_title = tab.title;
      user_obj.active_website_last_visit = now;

      chrome.storage.local.set({ user: user_obj });
    });
  });
});

/**
 * Listener for tab changes. Can assume that state exists when this is called,
 * and that there is a rabbithole for the window it currently is in.
 * 
 * Updates the user's active info with the contents of this tab. If the current
 * active website is different from the tab contents, updates the current rabbithole.
 */
chrome.tabs.onActivated.addListener(function (tab_obj) {
  console.log('tab change');
  /// This call works more reliably than chrome.tabs.get
  chrome.tabs.query({ active: true }, function (tabs) {
    // find the active tab for this window
    let tab;
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].windowId === tab_obj.windowId) tab = tabs[i];
    }

    chrome.storage.local.get({ user: {} }, function (data) {
      let user_obj = data.user;

      let rabbithole_idx = -1;
      let website_idx = -1;

      /// weird edge case, when tab event is triggered before window
      if (user_obj.rabbitholes === undefined) return;

      // get the active rabbithole
      for (let i = 0; i < user_obj.rabbitholes.length; i++) {
        if (user_obj.rabbitholes[i].rabbithole_id === user_obj.active_rabbithole_id) rabbithole_idx = i;
      }

      /// weird edge case, when tab event is triggered before window
      if (user_obj.rabbitholes[rabbithole_idx] === undefined) return;

      if (user_obj.rabbitholes[rabbithole_idx].website_list === undefined) user_obj.rabbitholes[rabbithole_idx].website_list = [];

      // update the last active website's tos
      for (let i = 0; i < user_obj.rabbitholes[rabbithole_idx].website_list.length; i++) {
        // find active website in the current rabbithole
        if (user_obj.rabbitholes[rabbithole_idx].website_list[i].url === user_obj.active_website) {
          // if it's somehow the same URL, abort
          if (user_obj.rabbitholes[rabbithole_idx].website_list[i].url === tab.url) return;
          if (user_obj.rabbitholes[rabbithole_idx].website_list[i].tos === undefined)
            user_obj.rabbitholes[rabbithole_idx].website_list[i].tos = [];
          user_obj.rabbitholes[rabbithole_idx].website_list[i].tos.push(tab.url);
        } else if (user_obj.rabbitholes[rabbithole_idx].website_list[i].url === history.url) {
          website_idx = i;
        }
      }

      if (website_idx === -1)
        // update website list with this tab
        user_obj.rabbitholes[rabbithole_idx].website_list.push({
          url: history.url,
          title: history.title,
          last_visited: history.lastVisitTime
        });

      // update user state
      user_obj.active_website = tab.url;
      user_obj.active_website_title = tab.title;
      user_obj.active_website_last_visit = Date.now();

      chrome.storage.local.set({ user: user_obj });
    });
  });
});

/**
 * Listener for new history events. Can assume that state exists when this is called,
 * and that there is a rabbithole for the window it currently is in.
 * 
 * Updates the user's active info with the contents of this tab, and updates the 
 * current rabbithole.
 */
chrome.history.onVisited.addListener(async function (history) {
  console.log('history update');

  // first, get user
  chrome.storage.local.get({ user: {} }, function (data) {
    let user_obj = data.user;

    let rabbithole_idx = -1;
    let website_idx = -1; // history.url's website record if it already exists 

    /// weird edge case, when tab event is triggered before window
    if (user_obj.rabbitholes === undefined) return;

    // get the active rabbithole
    for (let i = 0; i < user_obj.rabbitholes.length; i++) {
      if (user_obj.rabbitholes[i].rabbithole_id === user_obj.active_rabbithole_id) rabbithole_idx = i;
    }

    /// weird edge case, when tab event is triggered before window
    if (user_obj.rabbitholes[rabbithole_idx] === undefined) return;

    if (user_obj.rabbitholes[rabbithole_idx].website_list === undefined) user_obj.rabbitholes[rabbithole_idx].website_list = [];

    // update the last active website's tos
    for (let i = 0; i < user_obj.rabbitholes[rabbithole_idx].website_list.length; i++) {
      // find active website in the current rabbithole
      if (user_obj.rabbitholes[rabbithole_idx].website_list[i].url === user_obj.active_website) {
        // if it's somehow the same URL, abort
        if (user_obj.rabbitholes[rabbithole_idx].website_list[i].url === history.url) return;
        if (user_obj.rabbitholes[rabbithole_idx].website_list[i].tos === undefined)
          user_obj.rabbitholes[rabbithole_idx].website_list[i].tos = [];
        user_obj.rabbitholes[rabbithole_idx].website_list[i].tos.push(history.url);
      } else if (user_obj.rabbitholes[rabbithole_idx].website_list[i].url === history.url) {
        website_idx = i;
      }
    }

    if (website_idx === -1)
      // update website list with this tab
      user_obj.rabbitholes[rabbithole_idx].website_list.push({
        url: history.url,
        title: history.title,
        last_visited: history.lastVisitTime
      });

    // update user state
    user_obj.active_website = history.url;
    user_obj.active_website_title = history.title;
    user_obj.active_website_last_visit = history.lastVisitTime;
    chrome.storage.local.set({ user: user_obj });
  });
});


/* Pure functions */

function create_id() {
  return Math.random().toString(36).substr(2, 10);
};

function get_rabbithole_with_window_id(user_obj, id) {
  let rabbithole_id = '';
  for (let i = 0; i < user_obj.bindings.length; i++) {
    if (user_obj.bindings[i].window === id) rabbithole_id = user_obj.bindings[i].rabbithole_id;
  }
  if (rabbithole_id === '') return -1;
  for (let k = 0; k < user_obj.rabbitholes.length; k++) {
    if (user_obj.rabbitholes[k].rabbithole_id === rabbithole_id) return k;
  }
  return -2;
}
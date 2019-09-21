// Can't use ES6 due to compatibility issues :( 

chrome.history.onVisited.addListener(async function (history) {

  console.log(history)
  // first, get user
  chrome.storage.local.get({ user: {} }, function (data) {
    console.log(data);
    let user_obj = data.user;

    // if first time, set active website
    if (user_obj === {}) {
      user_obj.active_website = history.url;
      user_obj.lastVisited = history.lastVisitTime;
      user_obj.title = history.title;

      chrome.storage.local.set({ user: user_obj }, function (result) {
        console.log(result);
        // if no user, no website store; create it

        // add website to website list
        let website_list = [];

        console.log('init case');
        console.log(website_list);
        let new_website = {
          url: result.url,
          title: history.title,
          last_visited: history.lastVisitTime,
          tos: [],
          froms: []
        };
        website_list.push(new_website);

        chrome.storage.local.set({ websites: website_list });
      });

    } else {
      let active_website = user_obj.active_website;
      let active_website_title = user_obj.active_website_title;
      let active_website_last_visit = user_obj.active_website_last_visit;

      if (active_website === history.url) {
        return;
      }
      // websites HAS to exist
      chrome.storage.local.get({ websites: [] }, function (result) {
        let website_list = result.websites;
        let to_flag = 0, from_flag = 1;
        console.log(website_list);

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


        chrome.storage.local.set({ websites: website_list });
      });

      // update active website
      user_obj.active_website = history.url;
      user_obj.active_website_title = history.title;
      user_obj.active_website_last_visit = history.lastVisitTime;
      chrome.storage.local.set({ user: user_obj });
    }
  });
});

chrome.tabs.onActivated.addListener(function (tab_obj) {
  chrome.tabs.get(tab_obj.tabId, function (tab) {
    chrome.storage.local.get({ user: {} }, function (data) {
      console.log(data);
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

chrome.windows.onFocusChanged.addListener(function (window_id) {
  // if it's not a standard window, ignore
  if (window_id === -1) return;
  chrome.storage.local.get({ user: {} }, function (data) {
    let user_obj = data.user;
    let rabbithole_id = '';

    // if first time, create rabbithole map
    if (user_obj === {} || user_obj.rabbitholes === undefined) {
      user_obj.rabbitholes = [];
    }

    // find the rabbithole ID
    for (let i = 0; i < user_obj.rabbitholes.length; i++) {
      if (user_obj.rabbitholes[i].window_id === window_id) {
        rabbithole_id = user_obj.rabbitholes[i].rabbithole;
      }
    }
    if (rabbithole_id === '') {
      rabbithole_id = create_id();
      // update active website
      user_obj.rabbitholes.push({
        window_id: window_id,
        rabbithole: rabbithole_id
      });
    }
    user_obj.active_rabbithole = rabbithole_id;
    chrome.storage.local.set({ user: user_obj });
  });
});

function create_id() {
  return Math.random().toString(36).substr(2, 10);
};

// Can't use ES6 due to compatibility issues :( 

chrome.history.onVisited.addListener(async function(history) {
  alert('ayyy LMAO' + history.url);
  // first get user
  chrome.storage.local.get({ user: {} }, function(data) {
    console.log(data);
    let user_obj = data.user;

    // if first time, set active website
    if (user_obj === {}) {
      user_obj.active_website = result.url;

      chrome.storage.local.set({ user: user_obj }, function(result) {
        console.log(result);
        // if no user, no website store; create it
  
        // add website to website list
        let website_list = [];
  
        console.log('init case');
        console.log(website_list);
        let new_website = {
          url: result.url,
          tos: [],
          froms: []
        };
        website_list.push(new_website);
  
        chrome.storage.local.set({ websites: website_list }, function(result) {
          console.log('init case, for real');
          console.log(result);
        });
      });

    } else {
      let active_website = user_obj.active_website;
      // websites HAS to exist
      chrome.storage.local.get({ websites: [] }, function(result) {
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
            tos: [],
            froms: froms
          };
          website_list.push(new_website);
        }

          
        chrome.storage.local.set({ websites: website_list }, function(result) {
          console.log('NOT init case, for real');
          console.log(result);
        });
      });

      // update active website
      user_obj.active_website = history.url;
      chrome.storage.local.set({ user: user_obj }, function(result) {
        console.log(result);
      });
    }
  });
}); 

chrome.tabs.onActivated.addListener(function(tab_obj) {
  chrome.tabs.get(tab_obj.tabId, function(tab){
    alert('ayyy lmao ' + tab.url);
    chrome.storage.local.get({ user: {} }, function(data) {
      console.log(data);
      let user_obj = data.user;
  
      // if first time, set active website
      if (user_obj === {}) {
        user_obj.active_website = tab.url;
        chrome.storage.local.set({ user: user_obj }, function(result) {
          console.log(result);
        });
  
      } else {
        // update active website
        user_obj.active_website = tab.url;
        chrome.storage.local.set({ user: user_obj }, function(result) {
          console.log(result);
        });
      }
    });
  })
});

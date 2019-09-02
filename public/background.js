// function connect(name, version) {
//   return new Promise((resolve, reject) => {
//     const request = indexedDB.open(name, version);
//     // request.onupgradeneeded = function(event) {
//     //   let db = event.target.result;
//     //   let user_store = db.createObjectStore("user", { keyPath: "user_id" });
//     //   user_store.createIndex("active_website", "active_website", { unique: true });
//     //   user_store.createIndex("active_tab", "active_tab", { unique: true });
//     // };
//     request.onsuccess = () => resolve(request.result);
//     request.onerror = () => reject(request);
//     request.onblocked = () => { console.log('blocked'); };
//   });
// }

// function update_active(conn, item, value) {
//   return new Promise((resolve, reject) => {
//     const tx = conn.transaction(['user'], 'readwrite');
//     const store = tx.objectStore('user');
//     const request = store.getAll();
//     request.onsuccess = (event) => {
//       let user = event.target.result;
//       console.log(user);

//       user = user[0];
//       if(item === 'website') user.active_website = value
//       else if (item === 'tab') user.active_tab = value
//       else reject('gtfo');

//       let request_update = store.put(user);

//       request_update.onsuccess = resolve(request_update.result);
//       request_update.onerror = reject(request_update.error);
//     } 
//     request.onerror = () => reject(request.error);
//   });
// }

// chrome.history.onVisited.addListener(async function(result) {
//   alert(result.url)
//   // // await update_active_website(result.url);
//   // let connection;
//   // try {
//   //   connection = await connect("rabbitholeDB", 1);
//   //   console.log(connection);
//   //   await update_active(connection, 'website', result.url);
//   // } catch(exception) {
//   //   console.log(exception);
//   // } 
//   let port = chrome.runtime.connect({name: "knockknock"});
//   port.postMessage({ joke: result.url });
// }); 

// chrome.tabs.onCreated.addListener(function(tab) {
//   alert(tab.url);
//   // await update_active_tab(tab.url);
// });

/* 
  async function putValue(value) {
  let conn;
  try {
    conn = await connect(...);
    await doStuffWithConn(conn, value);
  } catch(exception) {
    console.error(exception);
  } finally {
    if(conn)
      conn.close();
  }
}

window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

if (!window.indexedDB) alert("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.");

let db;

let request = window.indexedDB.open("rabbitholeDB");
request.onerror = function(event) {
  console.log("Why didn't you allow my web app to use IndexedDB?!");
};
request.onsuccess = function(event) {
  db = event.target.result;
};

db.onerror = function(event) {
  // Generic error handler for all errors targeted at this database's
  // requests!
  alert("Database error: " + event.target.errorCode);
};
*/
//-------------------------------------------------------------------------------------------------------

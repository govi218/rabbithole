/*global chrome*/

import React from 'react';
import './App.css';

import Navbar from './components/Navbar/Navbar';
import VisCanvas from './components/VisCanvas/VisCanvas';

import { init_user, update_last_opened, update_active_website, update_active_tab, get_user } from './utils/db_methods';

class App extends React.Component {
  
  render() {

    init_user();

    // plan B; use active tab tracker and time since last open to construct graphs
    get_user()
    .then(async (user) => {
      let id = user[0].user_id;
      chrome.history.search({ 
        text: '', startTime: user[0].last_opened
      }, (hist_array) => {
        if(hist_array.length === 0) return;
        console.log(hist_array);
        let active = hist_array.reduce((max,current) => max.id < current.id? current: max, hist_array[0]);
        update_active_website(active.url);
      });
      update_last_opened(Date.now())
    });
    return (
      <div className="App">
        <Navbar />
        <VisCanvas />
      </div>
    );
  }
}

// chrome.runtime.onConnect.addListener(function(port) {
//   console.assert(port.name == "knockknock");
//   port.onMessage.addListener(function(msg) {
//     console.log(msg);
//   });
// });

export default App;

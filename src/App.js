/*global chrome*/

import React from 'react';
import './App.css';
import { get_websites, get_website_with_url } from './utils/db_methods'

import ProjectsView from './components/ProjectsView/ProjectsView'
import Navbar from './components/Navbar/Navbar';
import VisCanvas from './components/VisCanvas/VisCanvas';

import { init_user, update_last_opened, update_websites, get_user } from './utils/db_methods';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graph: {},
      flag: false
    }
  }

  render() {

    init_user();

    chrome.storage.local.get({ websites: [] }, function (result) {
      update_websites(result.websites);

      // flush storage
      chrome.storage.local.clear();
    });

    update_last_opened(Date.now())

    return (
      <div className="App">
        <Navbar />
        <VisCanvas />
        {/* <ProjectsView /> */}
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

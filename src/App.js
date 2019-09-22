/*global chrome*/

import React from 'react';
import './App.css';

import ProjectsView from './components/ProjectsView/ProjectsView'
import Navbar from './components/Navbar/Navbar';
import VisCanvas from './components/VisCanvas/VisCanvas';

import { init_user, update_last_opened, update_rabbitholes, update_active_rabbithole } from './utils/db_methods';

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

    chrome.storage.local.get({ user: {} }, function (result) {
      update_rabbitholes(result.user.rabbitholes);
      update_active_rabbithole(result.user.active_rabbithole);

      let updated_user = result.user;
      updated_user.rabbitholes = [];
      // flush storage
      chrome.storage.local.set({ user: updated_user });
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

export default App;

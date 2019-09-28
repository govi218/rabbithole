/*global chrome*/

import React from 'react';
import './App.css';

import Navbar from './components/Navbar/Navbar';
import VisCanvas from './components/VisCanvas/VisCanvas';

import { init_user, update_rabbitholes, update_active_rabbithole } from './utils/db_methods';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graph: {},
      flag: false
    }
  }

  componentDidMount() {
    let self = this;
    // get changes in local storage state to sync with indexedDB
    chrome.storage.local.get({ user: {} }, async function (result) {
      console.log('???');
      // check if user exists
      let first_time = await init_user();
      if (first_time === 1) {
        self.setState({ first_time: true }); // to be used for filling in first time user messages
      } else {
        console.log('not first time');
        self.setState({ first_time: false });
        // sync
        update_rabbitholes(result.user.rabbitholes);
        update_active_rabbithole(result.user.active_rabbithole_id);
      }

      // flush storage (while retaining bindings!!)
      let updated_user = result.user;
      updated_user.rabbitholes = [];
      chrome.storage.local.set({ user: updated_user });
      console.log(self);
      self.setState({ flag: true });
    });
  }

  render() {
    if (!this.state.flag) {
      return (
        <h2> Loading... </h2>
      )
    }
    console.log('????');
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

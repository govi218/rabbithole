/*global chrome*/
import React from 'react';
import './App.css';

import Navbar from './components/Navbar/Navbar';
import LRCanvas from './components/VisCanvas/VisCanvas';

import { init_user, get_user } from './utils/db_methods';

class App extends React.Component {
  
  render() {
    init_user();
    return (
      <div className="App">
        <Navbar />
        <main>
          <VisCanvas />
        </main>
      </div>
    );
  }
}

export default App;

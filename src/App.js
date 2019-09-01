/*global chrome*/
import React from 'react';
import './App.css';

import Navbar from './components/Navbar/Navbar';
import LRCanvas from './components/LRCanvas/LRCanvas';

import { init_user, get_user } from './utils/db_methods';

class App extends React.Component {
  
  render() {
    init_user();
    return (
      <div className="App">
        <Navbar />
        
        <main>
          <LRCanvas />
        </main>
      </div>
    );
  }
}

export default App;

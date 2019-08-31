/*global chrome*/
import React from 'react';
import './App.css';

import Navbar from './components/Navbar/Navbar';
import LRCanvas from './components/LRCanvas/LRCanvas'

class App extends React.Component {

  render() {
    return (
      <div className="App">
        <Navbar />
        <LRCanvas />
        <main>
        </main>
      </div>
    );
  }
}

export default App;

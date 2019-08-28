/*global chrome*/
import React from 'react';
import logo from './logo.svg';
import './App.css';

import Dropdown from './components/Dropdown/Dropdown'
import Button from './components/Button/Button';

class App extends React.Component {

  render() {
    return (
      <div className="App">
        <button
          onClick={() => {
            chrome.tabs.getCurrent(tab => {
              chrome.tabs.update(tab.index, {
                url: 'http://www.youtube.com',
              });
            });
          }}> Heyyo. </button>
        <Dropdown />
      </div>
    );
  }
}

export default App;

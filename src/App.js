/*global chrome*/
import React from 'react';
import logo from './logo.svg';
import './App.css';

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
        <h1> Hello World! </h1>
      </div>
    );
  }
}

export default App;

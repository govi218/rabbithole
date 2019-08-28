/*global chrome*/
import React from 'react';
import logo from './logo.svg';
import './App.css';

import Logo from './imgs/logo.png';
import Dropdown from './components/Dropdown/Dropdown'
import Button from './components/Button/Button';

class App extends React.Component {

  render() {
    return (
      <div className="App">
        <header> <img src={Logo} /> </header>
        <main>
          <Dropdown />
        </main>
      </div>
    );
  }
}

export default App;

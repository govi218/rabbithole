/*global chrome*/
import React from 'react';
import './App.css';

import Logo from './assets/imgs/logo.png';
import Button from '@material-ui/core/Button';
import Navbar from './components/Navbar/Navbar';

class App extends React.Component {

  render() {
    return (
      <div className="App">
        <Navbar />
        <main>
        </main>
      </div>
    );
  }
}

export default App;

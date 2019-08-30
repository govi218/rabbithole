/*global chrome*/
import React from 'react';
import './App.css';

import Logo from './assets/imgs/logo.png';
import Dropdown from './components/Dropdown/Dropdown'
import Button from './components/Button/Button';

class App extends React.Component {

  render() {
    return (
      <div className="App">
        <header> <img src={Logo} /> </header>
        <main>
          <ul>
          <li> <button>  Hi </button></li>
            <li> <input type="text" name="website" placeholder="Add a website you want to stop tracking."/>  </li>
            <a href="">  <li>  Daily Searches, Made from your history! </li> </a>
            <a href="">  
            <li>  
              Hyper Ledger.  
              <label class="switch">
                  <input type="checkbox"/>
                  <span class="slider round"></span>
              </label>
              </li> </a>
            <li> <input type="text" name="project" placeholder="Add a new project."/>  </li>
            
          </ul>
        </main>
      </div>
    );
  }
}

export default App;

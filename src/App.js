/*global chrome*/

import React from 'react';
import './App.css';
import { get_websites, get_website_with_url } from './utils/db_methods'

import Navbar from './components/Navbar/Navbar';
import VisCanvas from './components/VisCanvas/VisCanvas';

import { init_user, update_last_opened, update_websites, get_user } from './utils/db_methods';

export async function generateGraph() {

  // INITIAL PROTOTYPE, this needs to query rabbitholes!!

  let websites = await get_websites();

  // console.log(websites);

  // build graph 

  let
    graph = {},
    nodes = [],
    edges = [];

  // incredibly inefficient
  websites.forEach(element => {
    nodes.push({
      id: element.website_id,
      label: element.url
    });
    element.to_websites.forEach(async (to_website) => {
      let to_website_url = await get_website_with_url(to_website);
      // console.log(to_website_url);
      if (to_website_url[0] === undefined) return;
      let edge = {
        from: element.website_id,
        to: to_website_url[0].website_id
        // arrows: {
        //   to: {
        //     enabled: true
        //   }
        // }
      };
      // console.log(edge);
      edges.push(edge);
    });
  });
  graph['nodes'] = nodes;
  graph['edges'] = edges;
  // console.log(graph);
  // return new Promise((resolve, reject) => {
  //   setTimeout(function() {
  //     var didSucceed = Math.random() >= 0.5;
  //     didSucceed ? resolve(new Date()) : reject('Error');
  //   }, 2000);
  // })
  return graph;
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graph: {},
      flag: false
    }
  }
  componentDidMount() {
    console.log("MOUNT RENDER");
    let g = generateGraph().then((grph) => {
      console.log("This ish")
      this.setState({ graph: grph, flag: true });
    })
      .catch(err => {
        console.log(err)
        this.setState({ graph: err })
      });
    // generateGraph()
    //   .then((grph) => {
    //     this.setState((prevState, currProps) => {
    //       return {...prevState, graph: currProps.grph};
    //     })
    //     console.log(grph)
    //     //console.log(this.state)
    //   })
    //   .catch((err) => {
    //     console.log(err)
    //   });
    // console.log("PARANOIA WORKS IN MYSTERIOUS WAYS")
  }

  render() {

    init_user();

    chrome.storage.local.get({ websites: [] }, function (result) {
      update_websites(result.websites);

      // flush storage
      chrome.storage.local.clear();
    });

    update_last_opened(Date.now())
  
    if (!this.state.flag) {
      return (
        <h2> PARANOIA </h2>
      )
    } else {
      console.log(this.state);
      return (
        <div className="App">
          <Navbar />
          <VisCanvas graph={this.state.graph} />
        </div>
      );
    }
  }
}

// chrome.runtime.onConnect.addListener(function(port) {
//   console.assert(port.name == "knockknock");
//   port.onMessage.addListener(function(msg) {
//     console.log(msg);
//   });
// });

export default App;

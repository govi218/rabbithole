import React from 'react';
import Graph from 'vis-react';

import Sun from '../../assets/imgs/sun.png';

// The Options object defines the configuration of your 
// Network Graph.
let options = {
    groups: {
      queries: {
        shape: 'image',
        image: Sun,
      },
      resources: {
        shape: 'image',
        image: '../../imgs/mars1.png'
      },
      start: {
        shape: 'image',
        image: '../../imgs/rocket.png'
      },
      end: {
        shape: 'image',
        image: '../../imgs/finish.png'
      }
    },
    interaction: {
      hover: true,
      navigationButtons: true,
      keyboard: true
    }
  };

class LRCanvas extends React.Component {
    constructor(props) {
      super(props);
      let newGraph = {};
      this.state = {
        graph: {},
        style: {},
        network: null
      }
    }


    render() {
        return (
            
            <Graph
            graph={graph}
            options={options}
            events={events}
             />
        );
    }
}

export default LRCanvas;


import React from 'react';
import Graph from 'vis-react';
import { makeStyles } from '@material-ui/core/styles';
import DetailCard from '../DetailCard/DetailCard'
import Sun from '../../assets/imgs/sun.png';
import './VisCanvas.css'
import { Grid } from '@material-ui/core';


var graph = {
  nodes: [
    { id: 1, label: 'Node 1' },
    { id: 2, label: 'Node 2' },
    { id: 3, label: 'Node 3' },
    { id: 4, label: 'Node 4' },
    { id: 5, label: 'Node 5' }
  ],
  edges: [{ from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 4 }, { from: 2, to: 5 }]
};

var events = {
  select: function (event) {
    var { nodes, edges } = event;
  }
};


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

class VisCanvas extends React.Component {
  constructor(props) {
    super(props);
    let newGraph = {};
    this.state = {
      graph: {},
      style: {},
      network: null
    }
  }

  /* Precondition(s): 
    - typeof(history) is Array (Should probably be a queue)
  */
  generateGraph(history, graph_options) {
    // initialize graph (and options)
    let
      graph = {},
      nodes = [],
      edges = [],
      first_search = true, // why this paramater
      most_recent_search_id = -1, // why this paramater
      start_node,
      start_time,
      end_time,
      keywords = [];
 
    for(let node of history) {

    }
  }


  

  render() {
    return (
      <div className='canvas'>
        <Graph
          graph={graph}
          options={options}
          events={events}
        />
        <Grid container spacing={0}>
          <Grid item sm={5}>
            <DetailCard />
          </Grid>
          <Grid item sm={5}>
            <DetailCard />
          </Grid>
        </Grid>
      </div>
    );
  }
}

export default VisCanvas;


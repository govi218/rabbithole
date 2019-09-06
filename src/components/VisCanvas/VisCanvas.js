/*global chrome*/

import React from 'react';
import Graph from 'vis-react';
import { makeStyles } from '@material-ui/core/styles';
import DetailCard from '../DetailCard/DetailCard'
import Sun from '../../assets/imgs/sun.png';
import './VisCanvas.css'
import { Grid } from '@material-ui/core';
import { get_websites, get_website_with_url } from '../../utils/db_methods'

// let graph = {
//   nodes: [
//     { id: 1, label: 'Node 1' },
//     { id: 2, label: 'Node 2' },
//     { id: 3, label: 'Node 3' },
//     { id: 4, label: 'Node 4' },
//     { id: 5, label: 'Node 5' }
//   ],
//   edges: [{ from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 4 }, { from: 2, to: 5 }]
// };

let events = {
  // select: function (event) {
  //   let { nodes, edges } = event;
  // }
  beforeDrawing: (ctx) => {
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = '#222';
    ctx.fillRect(0,0,ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  },
  click: (ctx) => {
    // when a node is clicked; should contain website info
    // react card stuff goes here

    console.log(ctx.nodes);

    // if(ctx.nodes[0] !== undefined) {
    //   let node_data_html = '';
    //   let elementPos = nodes.map((x) => {return x.id}).indexOf(ctx.nodes[0]);

    //   let last_visit = new Date(nodes[elementPos]["lastVisitTime"]);

    //   let date = last_visit.getDate();
    //   let month = last_visit.getMonth();
    //   let year = last_visit.getFullYear();

    //   // Hours part from the timestamp
    //   let hours = last_visit.getHours();
    //   // Minutes part from the timestamp
    //   let minutes = "0" + last_visit.getMinutes();
    //   // Seconds part from the timestamp
    //   let seconds = "0" + last_visit.getSeconds();

    //   // Will display time in 10:30:23 format
    //   let formattedTime = date + '/' + month + '/' + year + ', ' + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
  
    //   network.focus(nodes[elementPos], {scale: 2});

    //   // node_data_html += '<p>ID: ' + nodes[elementPos]["id"] + '</p>';
    //   node_data_html += '<p>Last Visited: ' + formattedTime + '</p>'; 
    //   node_data_html += '<p>Title: ' + nodes[elementPos]["title"] + '</p>';
    //   node_data_html += '<p>URL: <a href=\"' + nodes[elementPos]["url"] + '\" target=\"_blank\">' + nodes[elementPos]["url"] + '</a></p>';
      
    //   document.getElementById(details).innerHTML = node_data_html; 
    // }
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
      image: '../../assets/imgs/mars1.png'
    },
    start: {
      shape: 'image',
      image: '../../assets/imgs/rocket.png'
    },
    end: {
      shape: 'image',
      image: '../../assets/imgs/finish.png'
    }
  },
  interaction: {
    hover: true,
    navigationButtons: true,
    keyboard: true
  }
};
 /* Precondition(s): 
    - typeof(history) is Array (Should probably be a queue)
    - history is sorted by recency of search.
  */
 let generateGraph = async () => {

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
  return graph;
}
class VisCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graph: {},
      style: {},
      network: null
    }
  }

  render() {
    let graph = generateGraph();
    console.log(graph)
    return (
      <div className='canvas'>
        <Graph
          graph={graph}
          options={options}
          events={events}
        />
        <Grid container spacing={2}>
          <Grid item sm={4}>
            <DetailCard />
          </Grid>
          <Grid item sm={4}>
            <DetailCard />
          </Grid>
        </Grid>
      </div>
    );
  }
}

export default VisCanvas;


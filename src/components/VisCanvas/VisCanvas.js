/*global chrome*/

import React from 'react';
import Graph from 'vis-react';
import { Grid } from '@material-ui/core';

import DetailCard from '../DetailCard/DetailCard';

// import Bang from '../../assets/space-set/png/001-big-bang.png';
// import Colony from '../../assets/space-set/png/002-colony.png';
// import Constellation from '../../assets/space-set/png/003-constellation.png';
import Planet from '../../assets/space-set/png/007-planet.png';
import Galaxy from '../../assets/space-set/png/008-galaxy.png';
import Saturn from '../../assets/space-set/png/023-saturn.png';

import Mars from '../../assets/imgs/mars1.png';

import { get_active_rabbithole } from '../../utils/db_methods';
import { get_website_with_url } from '../../utils/lib';
import './VisCanvas.css';

// The Options object defines the configuration of your 
// Network Graph.
let options = {
  groups: {
    queries: {
      shape: 'image',
      image: Galaxy
    },
    resources: {
      shape: 'image',
      image: Planet,
    },
    start: {
      shape: 'image',
      image: Saturn
    },
    end: {
      shape: 'image',
      image: Mars
    }
  },
  interaction: {
    hover: true,
    navigationButtons: true,
    keyboard: true
  }
};

/** Asynchronously generate a vis graph, from
 *  search history.
 */
export async function generateGraph() {

  console.log('?>?>?>');
  let active_rabbithole = await get_active_rabbithole();
  if (active_rabbithole === {}) return {};
  console.log(active_rabbithole);
  let websites = active_rabbithole[0].websites;

  let
    graph = {},
    nodes = [],
    edges = [];

  for (let website of websites) {
    const groups = ['queries', 'resources', 'start', 'end'];

    nodes.push({
      id: website.website_id,
      title: website.title,
      url: website.url,
      group: groups[Math.floor(Math.random() * groups.length)]
    });

    if (website.tos === undefined) continue;

    for (let to_website of website.tos) {
      let to_website_url = get_website_with_url(websites, to_website);
      
      if (to_website_url[0] === undefined) continue;

      let edge = {
        from: website.website_id,
        to: to_website_url[0].website_id
      };
      edges.push(edge);
    }
  }

  graph['nodes'] = nodes;
  graph['edges'] = edges;

  return graph;
}

class VisCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graph: {},
      style: {},
      flag: false,
      firstTime: true,
      hoverNode: { title: 'N/A', url: 'N/A' },
      network: null
    };
    this.handleHover = this.handleHover.bind(this)
    this.events = {
      hoverNode: this.handleHover
    };

  }

  handleHover(event) {
    for (let node of this.state.graph['nodes']) {
      if (node.id == event.node) {
        this.setState({ hoverNode: node });
        console.log(node.title)
        break;
      }
    }
  }

  getNetwork = data => {
    this.setState({ network: data });
    return data;
  };

  componentDidMount() {
    console.log("App Component Mounting...")
    console.log(this.state);
    if (!this.state.firstTime) return;
    generateGraph()
      .then((graph) => {
        this.setState({ graph: graph, flag: true });
        console.log("Graph State initialized...");
      })
      .catch(err => {
        this.setState({ graph: err })
        console.log(err)
      });
  }

  render() {
    console.log("Rendering Viscanvas...");
    // console.log(this.state.graph)

    if (!this.state.flag) {
      return (
        <h2> Loading... </h2>
      )
    } else {
      return (
        <div className='canvas'>
          <Graph
            graph={this.state.graph}
            options={options}
            events={this.events}
            getNetwork={this.getNetwork}
          />
          <Grid container spacing={2}>
            <Grid item sm={4}>
              <DetailCard title={this.state.hoverNode.title} url={this.state.hoverNode.url} />
            </Grid>
          </Grid>
        </div>
      );
    }
  }
}

export default VisCanvas;


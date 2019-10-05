import React from 'react';
import Grid from '@material-ui/core/Grid';
import ProjectCard from './SessionCard/ProjectCard';
import { makeStyles, withStyles } from '@material-ui/core/styles';

const styles = {
  root: {
    flexGrow: 1,
    padding: 20
  },
  card: {
    minWidth: 225,
    position: 'relative',
    backgroundColor: 'grey'
  }
};

/**
 * A session comprises of a rabbithole and some metadata. It is analgous
 * to a browsing session.
 */
class SessionsView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sessions: [1,1,1,2],
      active_session: 0
    }
  }

  /**
   * 
   */
  componentDidMount() {

  }
  
  render() {
    const { classes } = this.props;
    const items = [];

    for(let i=0; i <= this.state.sessions.length; i++){
      items.push(
        <Grid key={i} item>
          <ProjectCard active={true} />
        </Grid>
      );
    }
    return (
      <div>
        <Grid container justify="center" className={classes.root} spacing={10}>
          <Grid item xs={12}>
            <Grid container spacing={2}>
              {items}
            </Grid>
          </Grid>
        </Grid>
        <span> Add Project </span>
        <span> Go Back </span>
      </div>
    );
  }
}


export default withStyles(styles)(SessionsView);
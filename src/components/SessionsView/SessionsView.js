import React from 'react';
import Grid from '@material-ui/core/Grid';
import ProjectCard from './SessionCard/SessionCard';
import { withStyles } from '@material-ui/core/styles';

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
      sessions: [0,1,2,3,4],
      active_session: 0
    }
    this.cards = [];
    for(let i=0; i <= this.state.sessions.length; i++){
      this.cards.push(
        <Grid key={i} item>
          <ProjectCard title={i} date={true} handler={this.handleCardClick}/>
        </Grid>
      );
    }
  }

  /**
   * Update the rabbitholes and active rabbithole for this user.
   */
  componentDidMount() {

  }

  handleCardClick(active_card) {
    this.setState({active_session: active_card })
    this.cards[active_card].setState({active: true})
    console.log(this.cards[active_card])
    return 0;
  } 
  
  render() {
    const { classes } = this.props;
    const items = [];

    return (
      <div>
        <Grid container justify="center" className={classes.root} spacing={10}>
          <Grid item xs={12}>
            <Grid container spacing={2}>
              {this.cards}
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
import React from 'react';
import Grid from '@material-ui/core/Grid';
import ProjectCard from '../ProjectCard/ProjectCard';
import { makeStyles } from '@material-ui/core/styles';


const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
    padding: 20
  },
  card: {
    minWidth: 225,
    position: 'relative',
    backgroundColor: 'grey'
  },
  control: {
    padding: theme.spacing(2),
  },
}));

/**
 * Functional Component to render Projects View.
 */
export default function ProjectsView() {
  const [spacing, setSpacing] = React.useState(2);
  const classes = useStyles();

  return (
    <div>
<Grid container justify="center" className={classes.root} spacing={10}>
      <Grid item xs={12}>
        <Grid container spacing={spacing}>
          {[0, 1, 2, 3, 4].map(value => (
            <Grid key={value} item>
              <ProjectCard active={value==0}/>
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Grid>
    <span> Add Project </span>
    <span> Go Back </span>
    </div>
    
  );
}
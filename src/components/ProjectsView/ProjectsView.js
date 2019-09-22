import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Card from '@material-ui/core/Card';
import { CardContent } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import CardHeader from '@material-ui/core/CardHeader';

import './ProjectsView.css'
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


  function handleChange(event) {
    setSpacing(Number(event.target.value));
  }

  return (
    <Grid container justify="center" className={classes.root} spacing={10}>
      <Grid item xs={12}>
        <Grid container spacing={spacing}>
          {[0, 1, 2, 3, 4].map(value => (
            <Grid key={value} item>
              <Card className={classes.card}>
                <CardContent className={classes.hi}>
                  <Typography className={classes.title} color="textPrimary">
                    Title
                  </Typography>
                  <Typography className={classes.title} color="textSecondary">
                    Date Created
                  </Typography>
                  <div class="cont">
                    Active 
                    <span class="dot"></span>
                  </div>

                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Grid>
  );
}
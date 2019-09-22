import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Card from '@material-ui/core/Card';

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  card: {
    height: 200,
    width: 200,
  },
  control: {
    padding: theme.spacing(2),
  },
}));

export default function SpacingGrid() {
  const [spacing, setSpacing] = React.useState(2);
  const classes = useStyles();

  function handleChange(event) {
    setSpacing(Number(event.target.value));
  }

  return (
    <Grid container className={classes.root} spacing={5}>
      <Grid item xs={12}>
        <Grid container spacing={spacing}>
          {[0, 1, 2].map(value => (
            <Grid key={value} item>
              <Card className={classes.card} />
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Grid>
  );
}

import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(3, 2),
    position: 'absolute',
    bottom: '2.5%',
    left: '2.5%'
  },
}));

export default function DetailCard() {
  const classes = useStyles();

  return (
    <div>
      <Paper className={classes.root}>
        <Typography variant="h5" component="h3">
          This is the Website Title.
        </Typography>
        <Typography component="p">
          Timestamp: 
        </Typography>
        <Typography component="p">
          URL: 
        </Typography>
        <Typography component="p">
          Lastvisted: 
        </Typography>
      </Paper>
    </div>
  );
}
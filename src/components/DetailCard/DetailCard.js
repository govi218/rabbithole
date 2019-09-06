
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { textAlign } from '@material-ui/system';

const useStyles = makeStyles(theme => ({
  root: {
    position: 'fixed',
    padding: '10px',
    marginLeft: '2.5%',
    bottom: '2.5%',
    opacity: 0.5,
    '&:hover': {
       opacity: 1.0,
    }
  },
}));

export default function DetailCard() {
  const classes = useStyles();

  return (
      <Paper className={classes.root}>
        <Typography variant="h6" component="h3">
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
  );
}
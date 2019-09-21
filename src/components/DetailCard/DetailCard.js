
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles(theme => ({
  root: {
    position: 'fixed',
    padding: '10px',
    marginLeft: '2.5%',
    top: '12.5%',
    opacity: 0.5,
    '&:hover': {
       opacity: 1.0,
    }
  },
}));

export default function DetailCard(props) {
  const classes = useStyles();

  return (
      <Paper className={classes.root}>
        <Typography variant="h6" component="h3">
          {props.title}
        </Typography>
        <Typography component="p">
          Timestamp: 
        </Typography>
        <Typography component="p">
          URL: {props.url}
        </Typography>
      </Paper>
  );
}
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Button from '@material-ui/core/Button';
import Input from '@material-ui/core/Input';

import Logo from '../../assets/imgs/logo.png';

const useStyles = makeStyles(theme => ({
  root: {
    background: '#363946',
    flexGrow: 1,
  },
  bar: {
    background:'black'
  },
  buttons: {
    marginLeft: "auto"
  },
  icon: {
    margin: theme.spacing(4),
    fontSize: 32,
    flexGrow: 1
  },
}));

export default function Navbar() {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <AppBar className={classes.bar} position="static">
        <Toolbar>
          <img src={Logo} />
          <span className={classes.buttons}>
          <Button color="inherit">My Rabbitholes</Button>
          </span>
          
        </Toolbar>
      </AppBar>
    </div>
  );
}

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
    flexGrow: 2,
  },
  bar: {
    background:'black'
  },
  input: {
    margin: theme.spacing(2),
    width: '90%'
  },
  icon: {
    margin: theme.spacing(4),
    fontSize: 32,
  },

}));

export default function Navbar() {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <AppBar className={classes.bar} position="static">
        <Toolbar>
          <img src={Logo} />
          <Button color="inherit">Searches</Button>
          <Button color="inherit">Projects</Button>
        </Toolbar>
      </AppBar>
      {/* <Input
        defaultValue="Add a website you want to stop tracking."
        className={classes.input}
        inputProps={{
          'aria-label': 'description',
        }}
      /> */}
    </div>
  );
}

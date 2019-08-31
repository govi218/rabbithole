import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import Input from '@material-ui/core/Input';
import AddIcon from '@material-ui/icons/Add';

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
  }
}));

export default function Navbar() {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <AppBar className={classes.bar} position="static">
        <Toolbar>
          <img src={Logo} />
          <Button color="inherit">Searches</Button>
          <Button color="inherit">Hyperledger</Button>
          <AddIcon />
        </Toolbar>
        
      </AppBar>
      <Input
        defaultValue="Add a website you want to stop tracking."
        className={classes.input}
        inputProps={{
          'aria-label': 'description',
        }}
      />
    </div>
  );
}

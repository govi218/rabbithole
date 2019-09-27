import React from 'react';
import Card from '@material-ui/core/Card';
import { CardContent } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';

import './ProjectCard.css'

const useStyles = makeStyles(theme => ({
    card: {
        minWidth: 225,
        position: 'relative',
        backgroundColor: 'grey'
    },
    control: {
        padding: theme.spacing(2)
    },
}));

function ProjectCard(props) {
    const classes = useStyles();
    if (props.active) {
        return (
            <Card className={classes.card}>
                <CardContent>
                    <Typography className={classes.title} color="textPrimary">
                        Title
                  </Typography>
                    <Typography className={classes.title} color="textSecondary">
                        Date Created
                  </Typography>

                    <div class="cont">
                        Active <span class="dot"></span>
                    </div>
                </CardContent>
            </Card>
        )
    }
    return (
        <Card className={classes.card}>
            <CardContent>
                <Typography className={classes.title} color="textPrimary">
                    Title
                  </Typography>
                <Typography className={classes.title} color="textSecondary">
                    Date Created
                  </Typography>
            </CardContent>
        </Card>
    );
}

export default ProjectCard;
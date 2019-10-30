import React from 'react';
import Card from '@material-ui/core/Card';
import { CardContent } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import { withStyles } from '@material-ui/core/styles';
import CardActionArea from '@material-ui/core/CardActionArea';

import './SessionCard.css';

const styles = {
    card: {
        minWidth: 225,
        position: 'relative',
        backgroundColor: 'grey',
    }
};


class SessionCard extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            active: false
        }
    }

    render() {
        const { classes } = this.props;
        return (
            <CardActionArea onClick={() => this.props.handler(this.props.title)}>
                <Card className={classes.card}>
                    <CardContent>
                        <Typography className={classes.title} color="textPrimary">
                            Title
                        </Typography>
                        <Typography className={classes.title} color="textSecondary">
                            Date Created
                        </Typography>
                        {   this.props.active &&
                            <div class="cont">
                                Active <span class="dot"></span>
                            </div>
                        }
                    </CardContent>
                </Card>
            </CardActionArea>
        );
    }
}
export default withStyles(styles)(SessionCard);
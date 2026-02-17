
import React from "react";
import { Link } from "react-router-dom";

function Navbar() {

    return (

        <div style={styles.navbar}>

            <div style={styles.logo}>
                Logo
            </div>

            <div>

                <Link to="/home">
                    <button style={styles.button}>HOME</button>
                </Link>

                <Link to="/play">
                    <button style={styles.button}>PLAY</button>
                </Link>

                <Link to="/">
                    <button style={styles.button}>EXIT</button>
                </Link>

            </div>

        </div>

    );

}

const styles = {

    navbar: {
        display: "flex",
        justifyContent: "space-between",
        padding: "15px",
        backgroundColor: "#ddd"
    },

    logo: {
        border: "2px solid black",
        padding: "10px"
    },

    button: {
        margin: "5px",
        padding: "10px"
    }

};

export default Navbar;

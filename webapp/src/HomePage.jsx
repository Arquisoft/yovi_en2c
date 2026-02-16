import React from "react";
import Navbar from "./Navbar.jsx";
import { useNavigate } from "react-router-dom";

function HomePage() {

    const navigate = useNavigate();

    const username =
        localStorage.getItem("username") || "Guest";

    return (

        <div>

            <Navbar />

            <h1 style={styles.title}>
                GAME OF Y
            </h1>

            <div style={styles.username}>
                {username}
            </div>

            <button
                style={styles.playButton}
                onClick={() => navigate("/play")}
            >
                PLAY
            </button>

        </div>

    );

}

const styles = {

    title: {
        textAlign: "center",
        marginTop: "50px",
        fontSize: "48px"
    },

    username: {
        textAlign: "center",
        marginTop: "100px",
        fontSize: "24px"
    },

    playButton: {
        display: "block",
        margin: "40px auto",
        padding: "20px 60px",
        fontSize: "24px"
    }

};

export default HomePage;
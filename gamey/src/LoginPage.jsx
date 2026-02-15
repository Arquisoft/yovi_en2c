import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";

function LoginPage() {

    const [username, setUsername] = useState("");

    const navigate = useNavigate();

    function handleLogin() {

        if (username.trim() === "") return;

        localStorage.setItem("username", username);

        navigate("/home");
    }

    return (

        <div>

            <Navbar />

            <h1 style={styles.title}>LOGIN</h1>

            <div style={styles.box}>

                <div>

                    Username:

                    <input
                        style={styles.input}
                        value={username}
                        onChange={(e) =>
                            setUsername(e.target.value)
                        }
                    />

                </div>

                <button
                    style={styles.loginButton}
                    onClick={handleLogin}
                >
                    LOG IN
                </button>

            </div>

        </div>

    );

}

const styles = {

    title: {
        textAlign: "center",
        fontSize: "48px",
        marginTop: "40px"
    },

    box: {
        background: "#ccc",
        padding: "40px",
        display: "block",
        width: "400px",
        margin: "50px auto",
        textAlign: "center"
    },

    input: {
        marginLeft: "20px",
        padding: "10px"
    },

    loginButton: {
        marginTop: "30px",
        padding: "15px 50px",
        fontSize: "20px"
    }

};

export default LoginPage;
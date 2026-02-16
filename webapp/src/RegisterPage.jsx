import React from "react";
import Navbar from "./Navbar.jsx";
import RegisterForm from "./RegisterForm.tsx";

function RegisterPage() {

    return (

        <div>

            <Navbar />

            <h1 style={styles.title}>REGISTER</h1>

            <div style={styles.box}>
                <RegisterForm />
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
        width: "480px",
        margin: "50px auto",
        textAlign: "center"
    }

};

export default RegisterPage;

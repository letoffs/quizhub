import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const authLink = document.getElementById("authLink");

onAuthStateChanged(auth, (user) => {
    if (user) {
        authLink.textContent = "Выйти";
        authLink.href = "#";
        authLink.addEventListener("click", (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = "index.html";
            });
        });
    } else {
        authLink.textContent = "Войти";
        authLink.href = "login.html";
    }
});
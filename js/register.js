import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        // 1. Создаем пользователя в Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Сохраняем данные в Realtime Database
        await set(ref(db, 'users/' + user.uid), {
            email: email,
            displayName: name,
            role: "participant", // По умолчанию все новые пользователи - участники
            createdAt: Date.now()
        });

        alert("Регистрация успешна!");
        window.location.href = "index.html"; // Перекидываем на главную

    } catch (error) {
        // Обработка ошибок (например, такой email уже есть)
        alert("Ошибка: " + error.message);
    }
});
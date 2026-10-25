import { db, auth } from "./firebase.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const quizList = document.getElementById("quizList");
const greetingText = document.getElementById("greetingText");
const logo = document.getElementById("logo");

let categories = {};

// Загружаем категории
const categoriesRef = ref(db, "categories");
onValue(categoriesRef, (snapshot) => {
    categories = snapshot.val() || {};
});

// Загружаем квизы
const quizzesRef = ref(db, "quizzes");
onValue(quizzesRef, (snapshot) => {
    const data = snapshot.val();
    quizList.innerHTML = "";

    if (!data) {
        quizList.innerHTML = '<p class="loading">Пока нет доступных тестов</p>';
        return;
    }

    Object.keys(data).forEach((quizId) => {
        const quiz = data[quizId];
        const categoryName = categories[quiz.categoryId]?.categoryName || "Без категории";

        const card = document.createElement("div");
        card.className = "quiz-card";

        // Добавляем картинку, если она есть
        let coverHtml = "";
        if (quiz.imageUrl) {
            coverHtml = `<img src="${quiz.imageUrl}" alt="${quiz.title}" style="width: 100%; 
            height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">`;
        }

        card.innerHTML = `
            ${coverHtml}
            <span class="category">${categoryName}</span>
            <h3>${quiz.title}</h3>
            <p>${quiz.description || ""}</p>
            <div class="meta">
                ⏱ ${quiz.timeLimit || 0} мин · 
                ↺ ${quiz.attemptsAllowed || 1} попыток
            </div>
        `;
        
        card.addEventListener("click", () => {
            window.location.href = `quiz.html?id=${quizId}`;
        });
        
        quizList.appendChild(card);
    });
});

// Приветствие
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userSnap = await get(ref(db, `users/${user.uid}`));
            const userData = userSnap.val();
            
            if (userData && userData.displayName) {
                greetingText.textContent = `Привет, ${userData.displayName}! 👋`;
            } else {
                greetingText.textContent = "Привет, пользователь!";
            }
        } catch (error) {
            console.error("Ошибка загрузки имени:", error);
        }
    } else {
        greetingText.innerHTML = 'Добро пожаловать в QuizHub! <a href="login.html" style="color: #fff; text-decoration: underline;">Войдите</a>, чтобы отслеживать прогресс';
    }
});

// Пасхалка
let clickCount = 0;
let clickTimer;

if (logo) {
    logo.addEventListener("click", (e) => {
        e.preventDefault(); // Отменяем стандартный переход по ссылке

        clickCount++;

        clearTimeout(clickTimer);
        
        // Если это первый клик, ставим таймер на переход на главную (если не будет продолжения)
        if (clickCount === 1) {
            clickTimer = setTimeout(() => {
                window.location.href = "index.html";
            }, 500);
        } else {
            // Если кликают дальше, сбрасываем таймер перехода на главную
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                clickCount = 0; // Сбрасываем счетчик, если пауза больше 1 сек
            }, 1000);
        }

        // Если кликнули 5 раз
        if (clickCount === 5) {
            window.location.href = "admin.html";
            clickCount = 0;
        }
    });
}
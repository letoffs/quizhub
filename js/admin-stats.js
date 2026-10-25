import { db, auth } from "./firebase.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Элементы для карточек
const totalUsersEl = document.getElementById("totalUsers");
const totalQuizzesEl = document.getElementById("totalQuizzes");
const totalAttemptsEl = document.getElementById("totalAttempts");
const avgScoreEl = document.getElementById("avgScore");
const recentAttemptsTable = document.getElementById("recentAttemptsTable");

// Справочники для вывода имен
let usersData = {};
let quizzesData = {};

// Проверка авторизации
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    }
});

// Пользователи
onValue(ref(db, "users"), (snapshot) => {
    const data = snapshot.val() || {};
    usersData = data; // сохраняем для таблицы
    totalUsersEl.textContent = Object.keys(data).length;
});

// Тесты
onValue(ref(db, "quizzes"), (snapshot) => {
    const data = snapshot.val() || {};
    quizzesData = data; // сохраняем для таблицы
    totalQuizzesEl.textContent = Object.keys(data).length;
});

// Попытки (Attempts)
onValue(ref(db, "attempts"), (snapshot) => {
    const data = snapshot.val() || {};
    const attemptsArray = Object.values(data);
    allAttemptsData = data; 
    
    totalAttemptsEl.textContent = attemptsArray.length;

    // Считаем средний балл
    if (attemptsArray.length > 0) {
        const sum = attemptsArray.reduce((acc, attempt) => acc + (attempt.score || 0), 0);
        const avg = Math.round(sum / attemptsArray.length);
        avgScoreEl.textContent = avg + "%";
    } else {
        avgScoreEl.textContent = "0%";
    }

    // Выводим таблицу последних 5 попыток
    renderRecentAttempts(attemptsArray);
});

function renderRecentAttempts(attemptsArray) {
    const recent = attemptsArray
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, 10);

    if (recent.length === 0) {
        recentAttemptsTable.innerHTML = '<tr><td colspan="4">Нет данных о прохождениях</td></tr>';
        return;
    }

    recentAttemptsTable.innerHTML = "";

    recent.forEach(attempt => {
        const user = usersData[attempt.userId];
        const userName = user ? user.displayName : "Аноним";
        const quiz = quizzesData[attempt.quizId];
        const quizTitle = quiz ? quiz.title : "Тест удален";
        const date = new Date(attempt.completedAt).toLocaleString("ru-RU", {
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        const scoreColor = attempt.score >= 70 ? "#2ecc71" : "#e74c3c";

        const tr = document.createElement("tr");
        // Добавляем стиль курсора и обработчик клика
        tr.style.cursor = "pointer";
        tr.title = "Нажмите, чтобы посмотреть детали";
        
        tr.innerHTML = `
            <td>${userName}</td>
            <td>${quizTitle}</td>
            <td style="color: ${scoreColor}; font-weight: bold;">${attempt.score}%</td>
            <td>${date}</td>
        `;

        // Переход на страницу результатов по клику
        tr.addEventListener("click", () => {
            // Нам нужен ID попытки. В Firebase массив Object.values теряет ключи.
            // Поэтому нам нужно найти ключ по объекту.
            const attemptId = Object.keys(allAttemptsData).find(key => allAttemptsData[key] === attempt);
            if (attemptId) {
                window.location.href = `result.html?id=${attemptId}`;
            }
        });

        recentAttemptsTable.appendChild(tr);
    });
}
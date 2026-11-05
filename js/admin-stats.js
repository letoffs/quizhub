import { db, auth } from "./firebase.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Элементы для карточек
const totalUsersEl = document.getElementById("totalUsers");
const totalQuizzesEl = document.getElementById("totalQuizzes");
const totalAttemptsEl = document.getElementById("totalAttempts");
const avgScoreEl = document.getElementById("avgScore");
const recentAttemptsTable = document.getElementById("recentAttemptsTable");

// Справочники
let usersData = {};
let quizzesData = {};
let attemptsData = {};

// Проверка авторизации
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    }
});

// Загрузка данных
// Пользователи
onValue(ref(db, "users"), (snapshot) => {
    usersData = snapshot.val() || {};
    totalUsersEl.textContent = Object.keys(usersData).length;
    renderRecentAttempts(); // Пробуем отрисовать таблицу
});

// Тесты
onValue(ref(db, "quizzes"), (snapshot) => {
    quizzesData = snapshot.val() || {};
    totalQuizzesEl.textContent = Object.keys(quizzesData).length;
    renderRecentAttempts(); // Пробуем отрисовать таблицу
});

// Попытки (самое важное)
onValue(ref(db, "attempts"), (snapshot) => {
    attemptsData = snapshot.val() || {};
    
    // Считаем количество попыток
    const attemptsArray = Object.values(attemptsData);
    totalAttemptsEl.textContent = attemptsArray.length;

    // Считаем средний балл
    if (attemptsArray.length > 0) {
        const sum = attemptsArray.reduce((acc, attempt) => acc + (attempt.score || 0), 0);
        const avg = Math.round(sum / attemptsArray.length);
        avgScoreEl.textContent = avg + "%";
    } else {
        avgScoreEl.textContent = "0%";
    }

    renderRecentAttempts(); // Пробуем отрисовать таблицу
});


// Отрисовка таблицы
function renderRecentAttempts() {
    // Если таблицы нет на странице, выходим
    if (!recentAttemptsTable) return;

    // Проверяем, загрузились ли данные
    if (!usersData || !quizzesData || !attemptsData) return;

    // Превращаем объект попыток в массив
    const attemptsArray = Object.entries(attemptsData).map(([id, data]) => ({
        id: id,
        ...data
    }));

    // Если попыток нет вообще
    if (attemptsArray.length === 0) {
        recentAttemptsTable.innerHTML = '<tr><td colspan="4">Нет данных о прохождениях</td></tr>';
        return;
    }

    // Сортируем по дате (новые сверху) и берем 10
    const recent = attemptsArray
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
        .slice(0, 10);

    recentAttemptsTable.innerHTML = "";

    recent.forEach(attempt => {
        // Имя пользователя
        const user = usersData[attempt.userId];
        const userName = user ? user.displayName : "Удаленный пользователь";
        
        // Название теста
        const quiz = quizzesData[attempt.quizId];
        const quizTitle = quiz ? quiz.title : "Тест удален";

        // Дата
        const date = attempt.completedAt 
            ? new Date(attempt.completedAt).toLocaleString("ru-RU", {
                day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
            })
            : "Неизвестно";

        // Цвет балла
        const scoreColor = attempt.score >= 70 ? "#2ecc71" : "#e74c3c";

        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        
        tr.innerHTML = `
            <td>${userName}</td>
            <td>${quizTitle}</td>
            <td style="color: ${scoreColor}; font-weight: bold;">${attempt.score || 0}%</td>
            <td>${date}</td>
        `;

        // Клик по строке ведет на результаты
        tr.addEventListener("click", () => {
            window.location.href = `result.html?id=${attempt.id}`;
        });

        recentAttemptsTable.appendChild(tr);
    });
}
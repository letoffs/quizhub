import { db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Получаем ID попытки из URL
const urlParams = new URLSearchParams(window.location.search);
const attemptId = urlParams.get('id');

// Элементы страницы
const resultTitle = document.getElementById("resultTitle");
const scoreValue = document.getElementById("scoreValue");
const scoreCircle = document.getElementById("scoreCircle");
const statusText = document.getElementById("statusText");
const correctCount = document.getElementById("correctCount");
const totalCount = document.getElementById("totalCount");
const completedTime = document.getElementById("completedTime");
const retryBtn = document.getElementById("retryBtn");

async function loadResult() {
    if (!attemptId) {
        alert("Результат не найден!");
        window.location.href = "index.html";
        return;
    }

    try {
        // Загружаем результат
        const snapshot = await get(ref(db, `attempts/${attemptId}`));
        const data = snapshot.val();

        if (!data) {
            alert("Данные о результате не найдены!");
            return;
        }

        // Загружаем сам тест (чтобы знать тексты вопросов и систему оценивания)
        const quizSnap = await get(ref(db, `quizzes/${data.quizId}`));
        const quizData = quizSnap.val();

        // Заполняем основную инфу
        resultTitle.textContent = `Результат: ${quizData ? quizData.title : "Тест"}`;
        scoreValue.textContent = data.score;
        correctCount.textContent = data.correctAnswers;
        totalCount.textContent = data.totalQuestions;
        
        const date = new Date(data.completedAt);
        completedTime.textContent = date.toLocaleString("ru-RU");

        // Логика выставления оценки (на основе данных из теста)
        let grade = "2";
        let color = "#e74c3c"; // Красный по умолчанию

        // Берем систему оценивания из теста или ставим дефолтную (если старая запись)
        const grading = (quizData && quizData.gradingSystem) ? quizData.gradingSystem : {
            grade2: { min: 0, max: 49 },
            grade3: { min: 50, max: 69 },
            grade4: { min: 70, max: 89 },
            grade5: { min: 90, max: 100 }
        };

        // Определяем оценку
        if (data.score >= grading.grade5.min) {
            grade = "5";
            color = "#2ecc71";
        } else if (data.score >= grading.grade4.min) {
            grade = "4";
            color = "#c0b004"; 
        } else if (data.score >= grading.grade3.min) {
            grade = "3";
            color = "#c2730c";
        } else {
            grade = "2";
            color = "#e74c3c";
        }

        // Применяем стили
        scoreCircle.style.borderColor = color;
        statusText.textContent = `Оценка: ${grade}`;
        statusText.style.color = color;

        retryBtn.href = `quiz.html?id=${data.quizId}`;

        // Генерируем разбор ответов (если есть вопросы)
        if (quizData && quizData.questions) {
            renderDetails(quizData.questions, data.answers);
        }

    } catch (error) {
        console.error("Ошибка загрузки результата:", error);
    }
}

function renderDetails(questions, userAnswers) {
    const detailsList = document.getElementById("detailsList");
    const toggleBtn = document.getElementById("toggleDetailsBtn");
    const detailsContainer = document.getElementById("detailsContainer");

    if (!detailsList) return; // Защита, если элемента нет на странице

    detailsList.innerHTML = "";

    if (!questions || !userAnswers) return;

    Object.keys(questions).forEach(qId => {
        const q = questions[qId];
        const userAnswerId = userAnswers[qId]; // Какой вариант выбрал пользователь
        const userAnswerText = userAnswerId && q.options[userAnswerId] ? q.options[userAnswerId].optionText : "Нет ответа";
        
        // Находим правильный ответ
        let correctAnswerText = "";
        let isCorrect = false;
        
        Object.keys(q.options).forEach(optId => {
            if (q.options[optId].isCorrect) {
                correctAnswerText = q.options[optId].optionText;
            }
            if (optId === userAnswerId && q.options[optId].isCorrect) {
                isCorrect = true;
            }
        });

        // Создаем карточку вопроса
        const div = document.createElement("div");
        div.style.padding = "15px";
        div.style.borderRadius = "8px";
        div.style.border = `1px solid ${isCorrect ? '#2ecc71' : '#e74c3c'}`;
        div.style.background = isCorrect ? '#f0fdf4' : '#fef2f2';

        div.innerHTML = `
            <p style="font-weight: bold; margin-bottom: 10px;">${q.questionText}</p>
            <p style="font-size: 14px; margin-bottom: 5px;">
                <span style="color: #7f8c8d;">Ваш ответ:</span> 
                <span style="color: ${isCorrect ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">${userAnswerText}</span>
            </p>
            ${!isCorrect ? `<p style="font-size: 14px; margin-bottom: 5px;"><span style="color: #7f8c8d;">Правильный ответ:</span> <span style="color: #2ecc71; font-weight: bold;">${correctAnswerText}</span></p>` : ''}
            ${q.explanation ? `<p style="font-size: 13px; color: #7f8c8d; margin-top: 10px; font-style: italic;">Пояснение: ${q.explanation}</p>` : ''}
        `;
        detailsList.appendChild(div);
    });

    // Логика открытия/закрытия блока
    if (toggleBtn && detailsContainer) {
        toggleBtn.addEventListener("click", () => {
            if (detailsContainer.style.display === "none") {
                detailsContainer.style.display = "block";
                toggleBtn.textContent = "Скрыть разбор ответов";
            } else {
                detailsContainer.style.display = "none";
                toggleBtn.textContent = "Посмотреть разбор ответов";
            }
        });
    }
}

loadResult();
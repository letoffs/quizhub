import { auth, db } from "./firebase.js";
import { ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Получаем ID теста из URL
const urlParams = new URLSearchParams(window.location.search);
const quizId = urlParams.get('id');

// Переменные состояния
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = {};
let timerInterval; // Выносим сюда, чтобы иметь доступ из finishQuiz

const quizTitle = document.getElementById("quizTitle");
const questionCounter = document.getElementById("questionCounter");
const questionText = document.getElementById("questionText");
const optionsList = document.getElementById("optionsList");
const nextBtn = document.getElementById("nextBtn");

// Инициализация теста
async function initQuiz() {
    if (!quizId) {
        alert("Тест не выбран!");
        window.location.href = "index.html";
        return;
    }

    try {
        // Загружаем данные квиза из Firebase
        const snapshot = await get(ref(db, `quizzes/${quizId}`));
        const quizData = snapshot.val();

        if (!quizData || !quizData.questions) {
            alert("Тест не найден или в нем нет вопросов!");
            window.location.href = "index.html";
            return;
        }

        quizTitle.textContent = quizData.title;
        
        // Преобразуем объект вопросов в массив
        questions = Object.keys(quizData.questions).map(key => ({
            id: key,
            ...quizData.questions[key]
        }));

        if (quizData.shuffleQuestions) {
            questions = shuffleArray(questions);
        }

        // Запускаем таймер
        if (quizData.timeLimit) {
            startTimer(quizData.timeLimit * 60);
        }

        showQuestion();

    } catch (error) {
        console.error("Ошибка загрузки теста:", error);
        alert("Ошибка при загрузке теста.");
    }
}

// Показ текущего вопроса
function showQuestion() {
    if (currentQuestionIndex >= questions.length) {
        finishQuiz();
        return;
    }

    const q = questions[currentQuestionIndex];
    questionCounter.textContent = `Вопрос ${currentQuestionIndex + 1} из ${questions.length}`;
    questionText.textContent = q.questionText;
    optionsList.innerHTML = "";

    // Удаляем старую картинку, если была
    const existingImg = document.getElementById("questionImage");
    if (existingImg) existingImg.remove();

    // Добавляем новую картинку (если есть ссылка)
    if (q.mediaUrl) {
        const img = document.createElement("img");
        img.id = "questionImage";
        img.src = q.mediaUrl;
        img.style.maxWidth = "100%";
        img.style.maxHeight = "300px";
        img.style.borderRadius = "8px";
        img.style.marginBottom = "20px";
        img.style.display = "block";
        questionText.parentNode.insertBefore(img, optionsList);
    }

    // Выводим варианты ответов
    if (q.options) {
        // Получаем массив ключей (option1, option2, option3, option4)
        let optionKeys = Object.keys(q.options);
        
        // Перемешиваем ключи, чтобы правильный ответ не был всегда первым
        if (q.shuffleOptions !== false) { // По умолчанию перемешиваем
             optionKeys = shuffleArray(optionKeys);
        }

        optionKeys.forEach(optionId => {
            const option = q.options[optionId];
            const label = document.createElement("label");
            label.className = "option-label";
            label.innerHTML = `
                <input type="radio" name="answer" value="${optionId}" data-correct="${option.isCorrect}">
                <span>${option.optionText}</span>
            `;
            optionsList.appendChild(label);
        });
    }

    // Меняем кнопку на последнем вопросе
    if (currentQuestionIndex === questions.length - 1) {
        nextBtn.textContent = "Завершить тест";
        nextBtn.classList.add("btn-finish");
    } else {
        nextBtn.textContent = "Следующий вопрос";
        nextBtn.classList.remove("btn-finish");
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Обработка кнопки "Далее" / "Завершить"
nextBtn.addEventListener("click", () => {
    const selected = document.querySelector('input[name="answer"]:checked');
    if (!selected) {
        alert("Выберите вариант ответа!");
        return;
    }

    // Проверяем правильность
    const isCorrect = selected.getAttribute("data-correct") === "true";
    if (isCorrect) score++;

    // Сохраняем ответ
    const qId = questions[currentQuestionIndex].id;
    userAnswers[qId] = selected.value;

    // Переходим к следующему вопросу
    currentQuestionIndex++;
    
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        finishQuiz();
    }
});

// Завершение теста и сохранение результата
async function finishQuiz() {
    // ⚠️ ВАЖНО: Останавливаем таймер, чтобы он не сработал после завершения
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    const user = auth.currentUser;
    if (!user) {
        alert("Вы не авторизованы! Результат не будет сохранен.");
        window.location.href = "login.html";
        return;
    }

    // Считаем процент
    const percentage = Math.round((score / questions.length) * 100);

    try {
        // Сохраняем в базу
        const resultRef = push(ref(db, 'attempts'));
        await set(resultRef, {
            userId: user.uid,
            quizId: quizId,
            score: percentage,
            correctAnswers: score,
            totalQuestions: questions.length,
            completedAt: Date.now(),
            answers: userAnswers
        });

        // Перекидываем на страницу результата
        window.location.href = `result.html?id=${resultRef.key}`;
        
    } catch (error) {
        console.error("Ошибка сохранения результата:", error);
        alert("Ошибка при сохранении результата. Проверьте соединение с интернетом.");
    }
}

// Таймер
function startTimer(seconds) {
    const timerDisplay = document.getElementById("timer");
    timerInterval = setInterval(() => {
        if (seconds <= 0) {
            clearInterval(timerInterval);
            alert("Время вышло! Тест будет завершен автоматически.");
            finishQuiz();
            return;
        }
        seconds--;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${m}:${s}`;
    }, 1000);
}

// Запуск
initQuiz();
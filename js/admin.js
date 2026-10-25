import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, onValue, push, set, get, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Элементы интерфейса
const quizListView = document.getElementById("quizListView");
const quizFormView = document.getElementById("quizFormView");
const formTitle = document.getElementById("formTitle");
const editQuizIdInput = document.getElementById("editQuizId");
const adminQuizList = document.getElementById("adminQuizList");
const createQuizForm = document.getElementById("createQuizForm");
const questionsContainer = document.getElementById("questionsContainer");
const saveQuizBtn = document.getElementById("saveQuizBtn");
const quizCategorySelect = document.getElementById("quizCategory"); // Селект в форме

// Глобальный объект для категорий (будет заполняться из Firebase)
let allCategories = {};

// Переключение видов
document.getElementById("showCreateFormBtn").addEventListener("click", () => openForm());
document.getElementById("cancelFormBtn").addEventListener("click", () => closeForm());

// загрузка категорий
onValue(ref(db, "categories"), (snapshot) => {
    allCategories = snapshot.val() || {};
    
    // 1.1 Заполняем селект в форме создания/редактирования теста
    quizCategorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    Object.keys(allCategories).forEach(catId => {
        const option = document.createElement("option");
        option.value = catId;
        option.textContent = allCategories[catId].categoryName;
        quizCategorySelect.appendChild(option);
    });

    // 1.2 Заполняем таблицу категорий (если вы её выводите в админке)
    if (categoriesTable) {
        categoriesTable.innerHTML = "";
        const keys = Object.keys(allCategories);

        if (keys.length === 0) {
            categoriesTable.innerHTML = '<tr><td colspan="3">Нет созданных категорий</td></tr>';
        } else {
            keys.forEach(catId => {
                const cat = allCategories[catId];
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><code>${catId}</code></td>
                    <td>${cat.categoryName}</td>
                    <td class="actions">
                        <button class="btn-edit" data-id="${catId}" type="button">✎</button>
                        <button class="btn-delete-row" data-id="${catId}" type="button">🗑</button>
                    </td>
                `;

                // Редактировать
                tr.querySelector(".btn-edit").addEventListener("click", () => {
                    editCategoryIdInput.value = catId;
                    categoryNameInput.value = cat.categoryName;
                    saveCategoryBtn.textContent = "Сохранить";
                    cancelEditBtn.style.display = "inline-block";
                    categoryNameInput.focus();
                });

                // Удалить
                tr.querySelector(".btn-delete-row").addEventListener("click", async () => {
                    if (confirm(`Удалить категорию "${cat.categoryName}"?`)) {
                        try {
                            await remove(ref(db, `categories/${catId}`));
                        } catch (error) {
                            alert("Ошибка удаления: " + error.message);
                        }
                    }
                });

                categoriesTable.appendChild(tr);
            });
        }
    }

    // 1.3 Обновляем таблицу тестов (чтобы там отобразились правильные названия категорий)
    renderQuizzesTable();
});

// отрисовка таблицы тестов
let allQuizzes = {};

onValue(ref(db, "quizzes"), (snapshot) => {
    allQuizzes = snapshot.val() || {};
    renderQuizzesTable();
});

function renderQuizzesTable() {
    adminQuizList.innerHTML = "";
    
    const keys = Object.keys(allQuizzes);

    if (keys.length === 0) {
        adminQuizList.innerHTML = '<tr><td colspan="5">Нет созданных тестов</td></tr>';
        return;
    }

    keys.forEach(quizId => {
        const quiz = allQuizzes[quizId];
        const questionCount = quiz.questions ? Object.keys(quiz.questions).length : 0;
        
        // Берем название категории из объекта allCategories
        const categoryName = allCategories[quiz.categoryId] 
            ? allCategories[quiz.categoryId].categoryName 
            : "Без категории";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${quiz.title}</td>
            <td>${categoryName}</td>
            <td>${quiz.timeLimit} мин</td>
            <td>${questionCount}</td>
            <td class="actions">
                <button class="btn-edit" data-id="${quizId}">✎</button>
                <button class="btn-delete-row" data-id="${quizId}">🗑</button>
            </td>
        `;
        
        tr.querySelector(".btn-edit").addEventListener("click", () => {
            openForm(quizId, quiz);
        });

        tr.querySelector(".btn-delete-row").addEventListener("click", async () => {
            if (confirm(`Вы уверены, что хотите удалить тест "${quiz.title}"?`)) {
                try {
                    await remove(ref(db, `quizzes/${quizId}`));
                } catch (error) {
                    alert("Ошибка удаления: " + error.message);
                }
            }
        });

        adminQuizList.appendChild(tr);
    });
}

// форма создания/редактирования теста
function openForm(quizId = null, quizData = null) {
    quizListView.style.display = "none";
    quizFormView.style.display = "block";
    createQuizForm.reset();
    questionsContainer.innerHTML = "";
    
    if (quizId && quizData) {
        formTitle.textContent = "Редактирование теста";
        editQuizIdInput.value = quizId;
        document.getElementById("quizTitle").value = quizData.title;
        document.getElementById("quizDescription").value = quizData.description || "";
        document.getElementById("quizCategory").value = quizData.categoryId;
        document.getElementById("quizTimeLimit").value = quizData.timeLimit;
        document.getElementById("quizAttempts").value = quizData.attemptsAllowed;
        document.getElementById("quizPassingScore").value = quizData.passingScore;
        document.getElementById("quizImage").value = quizData.imageUrl || "";

        // Загружаем вопросы
        if (quizData.questions) {
            Object.keys(quizData.questions).forEach(qId => {
                const q = quizData.questions[qId];
                
                // Достаем тексты вариантов
                const opt1 = q.options.option1.optionText;
                const opt2 = q.options.option2.optionText;
                const opt3 = q.options.option3.optionText;
                const opt4 = q.options.option4.optionText;
                
                // Определяем, какой вариант правильный (по умолчанию 0)
                let correctIndex = 0;
                if (q.options.option2.isCorrect) correctIndex = 1;
                if (q.options.option3.isCorrect) correctIndex = 2;
                if (q.options.option4.isCorrect) correctIndex = 3;
                
                addQuestionBlock(q.questionText, opt1, opt2, opt3, opt4, q.explanation, 
                    q.mediaUrl || "", correctIndex);
            });
        }
    } else {
        formTitle.textContent = "Создание нового теста";
        editQuizIdInput.value = "";
        addQuestionBlock();
    }
}

function closeForm() {
    quizFormView.style.display = "none";
    quizListView.style.display = "block";
}

// Добавление блока вопроса
function addQuestionBlock(text = "", o1 = "", o2 = "", o3 = "", o4 = "", expl = "", img = "", correctIndex = 0) {
    const blockId = `question_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const block = document.createElement("div");
    block.className = "question-block";
    block.id = blockId;
    
    // Функция для генерации одного варианта
    const renderOption = (optId, optValue, isCorrect, labelText) => `
        <div class="option-row">
            <label class="option-radio-label">
                <input type="radio" name="correct_${blockId}" value="${optId}" ${isCorrect ? 'checked' : ''} required>
                <span>${labelText}</span>
            </label>
            <input type="text" class="q-opt${optId.replace('option', '')}" required value="${optValue}" placeholder="Введите текст варианта...">
        </div>
    `;

    block.innerHTML = `
        <h3>Вопрос <button type="button" class="btn-delete" onclick="document.getElementById('${blockId}').remove()">✖</button></h3>
        <div class="form-group"><label>Текст вопроса</label><input type="text" class="q-text" required value="${text}"></div>
        
        <div class="form-group">
            <label>Ссылка на картинку вопроса (опционально)</label>
            <input type="text" class="q-image" placeholder="images/question.png" value="${img}">
        </div>

        <p style="font-size: 14px; color: #7f8c8d; margin-bottom: 10px; margin-top: 20px;">
            Отметьте правильный вариант кружком
        </p>

        ${renderOption("option1", o1, correctIndex === 0, "Вариант 1")}
        ${renderOption("option2", o2, correctIndex === 1, "Вариант 2")}
        ${renderOption("option3", o3, correctIndex === 2, "Вариант 3")}
        ${renderOption("option4", o4, correctIndex === 3, "Вариант 4")}

        <div class="form-group" style="margin-top: 20px;"><label>Пояснение (почему этот ответ правильный)</label><input type="text" class="q-explanation" value="${expl}"></div>
    `;
    questionsContainer.appendChild(block);
}

document.getElementById("addQuestionBtn").addEventListener("click", () => addQuestionBlock());

// Сохранение теста
createQuizForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveQuizBtn.disabled = true;
    saveQuizBtn.textContent = "Сохранение...";

    try {
        const existingQuizId = editQuizIdInput.value;
        
        const quizData = {
            title: document.getElementById("quizTitle").value,
            description: document.getElementById("quizDescription").value,
            categoryId: document.getElementById("quizCategory").value,
            timeLimit: parseInt(document.getElementById("quizTimeLimit").value),
            attemptsAllowed: parseInt(document.getElementById("quizAttempts").value),
            passingScore: parseInt(document.getElementById("quizPassingScore").value),
            imageUrl: document.getElementById("quizImage").value,
            shuffleQuestions: true,
            createdBy: auth.currentUser ? auth.currentUser.uid : "admin",
            createdAt: Date.now(),
            questions: {}
        };

        const questionBlocks = document.querySelectorAll(".question-block");
        if (questionBlocks.length === 0) {
            alert("Добавьте хотя бы один вопрос!");
            saveQuizBtn.disabled = false;
            saveQuizBtn.textContent = "Сохранить тест";
            return;
        }

        questionBlocks.forEach((block, index) => {
            // Находим выбранную радио-кнопку внутри этого блока
            const selectedRadio = block.querySelector(`input[name="correct_${block.id}"]:checked`);
            const selectedValue = selectedRadio ? selectedRadio.value : "option1"; // По умолчанию option1

            quizData.questions[`q${index + 1}`] = {
                questionText: block.querySelector(".q-text").value,
                typeId: "type1",
                explanation: block.querySelector(".q-explanation").value,
                hints: "",
                mediaUrl: block.querySelector(".q-image").value,
                options: {
                    "option1": { optionText: block.querySelector(".q-opt1").value, isCorrect: selectedValue === "option1" },
                    "option2": { optionText: block.querySelector(".q-opt2").value, isCorrect: selectedValue === "option2" },
                    "option3": { optionText: block.querySelector(".q-opt3").value, isCorrect: selectedValue === "option3" },
                    "option4": { optionText: block.querySelector(".q-opt4").value, isCorrect: selectedValue === "option4" }
                }
            };
        });

        if (existingQuizId) {
            await set(ref(db, `quizzes/${existingQuizId}`), quizData);
            alert("Тест успешно обновлен!");
        } else {
            const newQuizRef = push(ref(db, 'quizzes'));
            await set(newQuizRef, quizData);
            alert("Тест успешно создан!");
        }

        closeForm();

    } catch (error) {
        console.error(error);
        alert("Ошибка: " + error.message);
    } finally {
        saveQuizBtn.disabled = false;
        saveQuizBtn.textContent = "Сохранить тест";
    }
});

// управление категориями
const categoryForm = document.getElementById("categoryForm");
const categoryNameInput = document.getElementById("categoryName");
const editCategoryIdInput = document.getElementById("editCategoryId");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const categoriesTable = document.getElementById("categoriesTable");

// Сохранение категории (Добавление или Обновление)
if (categoryForm) {
    categoryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = categoryNameInput.value.trim();
        const editId = editCategoryIdInput.value;

        if (!name) return;

        saveCategoryBtn.disabled = true;
        saveCategoryBtn.textContent = "Сохранение...";

        try {
            if (editId) {
                await update(ref(db, `categories/${editId}`), { categoryName: name });
            } else {
                const newCatRef = push(ref(db, "categories"));
                await set(newCatRef, { categoryName: name });
            }
            
            categoryForm.reset();
            editCategoryIdInput.value = "";
            saveCategoryBtn.textContent = "Добавить";
            cancelEditBtn.style.display = "none";

        } catch (error) {
            alert("Ошибка: " + error.message);
        } finally {
            saveCategoryBtn.disabled = false;
        }
    });
}

// Отмена редактирования
if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
        categoryForm.reset();
        editCategoryIdInput.value = "";
        saveCategoryBtn.textContent = "Добавить";
        cancelEditBtn.style.display = "none";
    });
}

// Проверка авторизации
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    }
});
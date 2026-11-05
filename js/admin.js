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
const quizCategorySelect = document.getElementById("quizCategory");

let allCategories = {};
let currentUserRole = null; // Роль текущего пользователя
let currentUserId = null;   // ID текущего пользователя

// проверка авторизации и роли
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await get(ref(db, `users/${user.uid}`));
        if (userSnap.exists()) {
            const userData = userSnap.val();
            currentUserRole = userData.role;
            currentUserId = user.uid;

            // Если участник — выкидываем на главную
            if (currentUserRole === "participant") {
                alert("У вас нет прав для доступа к админ-панели!");
                window.location.href = "index.html";
            }
        } else {
            window.location.href = "login.html";
        }
    } else {
        window.location.href = "login.html";
    }

    renderQuizzesTable();
});

// загрузка категорий
onValue(ref(db, "categories"), (snapshot) => {
    allCategories = snapshot.val() || {};
    
    // Заполняем селект в форме создания теста
    quizCategorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    Object.keys(allCategories).forEach(catId => {
        const option = document.createElement("option");
        option.value = catId;
        option.textContent = allCategories[catId].categoryName;
        quizCategorySelect.appendChild(option);
    });

    // Отрисовываем таблицу категорий
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

                // Кнопка редактирования
                tr.querySelector(".btn-edit").addEventListener("click", () => {
                    editCategoryIdInput.value = catId;
                    categoryNameInput.value = cat.categoryName;
                    saveCategoryBtn.textContent = "Сохранить";
                    cancelEditBtn.style.display = "inline-block";
                    categoryNameInput.focus();
                });

                // Кнопка удаления
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

    // Обновляем таблицу тестов (чтобы там отобразились названия категорий)
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
        
        const categoryName = allCategories[quiz.categoryId] 
            ? allCategories[quiz.categoryId].categoryName 
            : "Без категории";

        // логика прав доступа
        let canEdit = false;
        
        if (currentUserRole === "admin") {
            canEdit = true; // Админ может всё
        } else if (currentUserRole === "moderator") {
            // Модератор может только свои
            if (quiz.createdBy === currentUserId) {
                canEdit = true;
            }
        }

        const actionsHtml = canEdit 
            ? `<button class="btn-edit" data-id="${quizId}">✎</button>
               <button class="btn-delete-row" data-id="${quizId}">🗑</button>`
            : `<span style="color: #95a5a6; font-size: 12px;">Только просмотр</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${quiz.title}</td>
            <td>${categoryName}</td>
            <td>${quiz.timeLimit} мин</td>
            <td>${questionCount}</td>
            <td class="actions">${actionsHtml}</td>
        `;
        
        if (canEdit) {
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
        }

        adminQuizList.appendChild(tr);
    });
}

// форма создания/редактирования теста
document.getElementById("showCreateFormBtn").addEventListener("click", () => openForm());
document.getElementById("cancelFormBtn").addEventListener("click", () => closeForm());

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

        // загрузка системы оценивания
        if (quizData.gradingSystem) {
            document.getElementById("grade2Min").value = quizData.gradingSystem.grade2.min;
            document.getElementById("grade2Max").value = quizData.gradingSystem.grade2.max;
            document.getElementById("grade3Min").value = quizData.gradingSystem.grade3.min;
            document.getElementById("grade3Max").value = quizData.gradingSystem.grade3.max;
            document.getElementById("grade4Min").value = quizData.gradingSystem.grade4.min;
            document.getElementById("grade4Max").value = quizData.gradingSystem.grade4.max;
            document.getElementById("grade5Min").value = quizData.gradingSystem.grade5.min;
            document.getElementById("grade5Max").value = quizData.gradingSystem.grade5.max;
        } else {
            // Если система оценивания не была настроена ранее (старый тест)
            document.getElementById("grade2Min").value = 0;
            document.getElementById("grade2Max").value = 49;
            document.getElementById("grade3Min").value = 50;
            document.getElementById("grade3Max").value = 69;
            document.getElementById("grade4Min").value = 70;
            document.getElementById("grade4Max").value = 89;
            document.getElementById("grade5Min").value = 90;
            document.getElementById("grade5Max").value = 100;
        }

        if (quizData.questions) {
            Object.keys(quizData.questions).forEach(qId => {
                const q = quizData.questions[qId];
                
                const type = q.typeId === "type3" ? "text" : "single";
                
                let opt1 = "", opt2 = "", opt3 = "", opt4 = "";
                let correctIndex = 0;

                if (type === "text") {
                    opt1 = q.options.option1 ? q.options.option1.optionText : "";
                } else {
                    opt1 = q.options.option1 ? q.options.option1.optionText : "";
                    opt2 = q.options.option2 ? q.options.option2.optionText : "";
                    opt3 = q.options.option3 ? q.options.option3.optionText : "";
                    opt4 = q.options.option4 ? q.options.option4.optionText : "";

                    if (q.options.option2 && q.options.option2.isCorrect) correctIndex = 1;
                    if (q.options.option3 && q.options.option3.isCorrect) correctIndex = 2;
                    if (q.options.option4 && q.options.option4.isCorrect) correctIndex = 3;
                }
                
                addQuestionBlock(q.questionText, opt1, opt2, opt3, opt4, q.explanation, q.mediaUrl || "", correctIndex, type);
            });
        }
    } else {
        formTitle.textContent = "Создание нового теста";
        editQuizIdInput.value = "";
        
        // Сброс системы оценивания на дефолтные значения при создании нового теста
        document.getElementById("grade2Min").value = 0;
        document.getElementById("grade2Max").value = 49;
        document.getElementById("grade3Min").value = 50;
        document.getElementById("grade3Max").value = 69;
        document.getElementById("grade4Min").value = 70;
        document.getElementById("grade4Max").value = 89;
        document.getElementById("grade5Min").value = 90;
        document.getElementById("grade5Max").value = 100;

        addQuestionBlock();
    }
}

function closeForm() {
    quizFormView.style.display = "none";
    quizListView.style.display = "block";
}

function addQuestionBlock(text = "", o1 = "", o2 = "", o3 = "", o4 = "", expl = "", img = "", correctIndex = 0, type = "single") {
    const blockId = `question_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const block = document.createElement("div");
    block.className = "question-block";
    block.id = blockId;
    
    const renderOption = (optId, optValue, isCorrect, labelText) => `
        <div class="option-row">
            <label class="option-radio-label">
                <input type="radio" name="correct_${blockId}" value="${optId}" ${isCorrect ? 'checked' : ''}>
                <span>${labelText}</span>
            </label>
            <input type="text" class="q-opt${optId.replace('option', '')}" value="${optValue}">
        </div>
    `;

    // Определяем, какой контейнер показывать изначально
    const displayOptions = type === 'text' ? 'none' : 'block';
    const displayText = type === 'text' ? 'block' : 'none';

    block.innerHTML = `
        <h3>Вопрос <button type="button" class="btn-delete" onclick="document.getElementById('${blockId}').remove()">✖</button></h3>
        
        <div class="form-group">
            <label>Тип вопроса</label>
            <select class="q-type" style="width: 100%; padding: 10px; border: 1px solid #bdc3c7; border-radius: 5px; font-size: 16px; margin-bottom: 15px;">
                <option value="single" ${type === 'single' ? 'selected' : ''}>Одиночный выбор</option>
                <option value="text" ${type === 'text' ? 'selected' : ''}>Текстовый ответ</option>
            </select>
        </div>

        <div class="form-group"><label>Текст вопроса</label><input type="text" class="q-text" required value="${text}"></div>
        
        <div class="form-group">
            <label>Ссылка на картинку (опционально)</label>
            <input type="text" class="q-image" placeholder="images/question.png" value="${img}">
        </div>
        
        <div class="options-container" style="display: ${displayOptions};">
            <p style="font-size: 14px; color: #7f8c8d; margin-bottom: 10px;">Отметьте правильный вариант:</p>
            ${renderOption("option1", o1, correctIndex === 0, "Вариант 1")}
            ${renderOption("option2", o2, correctIndex === 1, "Вариант 2")}
            ${renderOption("option3", o3, correctIndex === 2, "Вариант 3")}
            ${renderOption("option4", o4, correctIndex === 3, "Вариант 4")}
        </div>

        <div class="text-answer-container" style="display: ${displayText};">
            <div class="form-group" style="background: #e8f4fd; padding: 15px; border-radius: 8px; border: 1px solid #b6d4fe;">
                <label>Правильный текстовый ответ</label>
                <input type="text" class="q-correct-text" placeholder="Введите правильный ответ..." value="${type === 'text' ? o1 : ''}">
                <small style="color: #7f8c8d; display: block; margin-top: 5px;">Проверка происходит без учета регистра.</small>
            </div>
        </div>

        <div class="form-group" style="margin-top: 20px;"><label>Пояснение</label><input type="text" class="q-explanation" value="${expl}"></div>
    `;
    
    // Навешиваем обработчик события на селект
    const select = block.querySelector('.q-type');
    select.addEventListener('change', function() {
        const optionsCont = block.querySelector('.options-container');
        const textCont = block.querySelector('.text-answer-container');
        
        if (this.value === 'text') {
            optionsCont.style.display = 'none';
            textCont.style.display = 'block';
        } else {
            optionsCont.style.display = 'block';
            textCont.style.display = 'none';
        }
    });

    questionsContainer.appendChild(block);
}

function toggleQuestionType(select) {
    const block = select.closest('.question-block');
    const optionsContainer = block.querySelector('.options-container');
    const textContainer = block.querySelector('.text-answer-container');
    
    if (select.value === 'text') {
        optionsContainer.style.display = 'none';
        textContainer.style.display = 'block';
    } else {
        optionsContainer.style.display = 'block';
        textContainer.style.display = 'none';
    }
}

document.getElementById("addQuestionBtn").addEventListener("click", () => addQuestionBlock());

// СОХРАНЕНИЕ ТЕСТА
createQuizForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const g2Min = parseInt(document.getElementById("grade2Min").value);
    const g2Max = parseInt(document.getElementById("grade2Max").value);
    const g3Min = parseInt(document.getElementById("grade3Min").value);
    const g3Max = parseInt(document.getElementById("grade3Max").value);
    const g4Min = parseInt(document.getElementById("grade4Min").value);
    const g4Max = parseInt(document.getElementById("grade4Max").value);
    const g5Min = parseInt(document.getElementById("grade5Min").value);
    const g5Max = parseInt(document.getElementById("grade5Max").value);

    // Проверка на выход за пределы 0-100
    if (g2Min < 0 || g2Max > 100 || g3Min < 0 || g3Max > 100 || g4Min < 0 || g4Max > 100 || g5Min < 0 || g5Max > 100) {
        alert("Значения оценок должны быть в диапазоне от 0 до 100!");
        return;
    }

    // Проверка логики: "от" должно быть меньше или равно "до"
    if (g2Min > g2Max || g3Min > g3Max || g4Min > g4Max || g5Min > g5Max) {
        alert("Ошибка: Значение 'от' не может быть больше значения 'до'!");
        return;
    }

    // Проверка непрерывности и порядка (2 -> 3 -> 4 -> 5)
    if (g2Max >= g3Min || g3Max >= g4Min || g4Max >= g5Min) {
        alert("Ошибка: Диапазоны оценок пересекаются! Оценка '3' должна начинаться после окончания '2' и так далее.");
        return;
    }
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
            // Если это новый тест, записываем создателя. Если редактируем — оставляем старого.
            createdBy: existingQuizId ? allQuizzes[existingQuizId].createdBy : currentUserId, 
            createdAt: existingQuizId ? allQuizzes[existingQuizId].createdAt : Date.now(),
            questions: {},
            gradingSystem: {
                grade2: { min: g2Min, max: g2Max },
                grade3: { min: g3Min, max: g3Max },
                grade4: { min: g4Min, max: g4Max },
                grade5: { min: g5Min, max: g5Max }
            }
        };

        const questionBlocks = document.querySelectorAll(".question-block");
        if (questionBlocks.length === 0) {
            alert("Добавьте хотя бы один вопрос!");
            saveQuizBtn.disabled = false;
            saveQuizBtn.textContent = "Сохранить тест";
            return;
        }

        questionBlocks.forEach((block, index) => {
            const type = block.querySelector(".q-type").value;
            
            let questionData = {
                questionText: block.querySelector(".q-text").value,
                typeId: type === "text" ? "type3" : "type1",
                explanation: block.querySelector(".q-explanation").value,
                hints: "",
                mediaUrl: block.querySelector(".q-image").value,
                options: {}
            };

            if (type === "text") {
                // Если это текст, берем значение из поля "Правильный текстовый ответ"
                const correctText = block.querySelector(".q-correct-text").value;
                questionData.options = {
                    "option1": { optionText: correctText, isCorrect: true }
                };
            } else {
                // Если это выбор, собираем 4 варианта и проверяем радиокнопку
                const selectedRadio = block.querySelector(`input[name="correct_${block.id}"]:checked`);
                const selectedValue = selectedRadio ? selectedRadio.value : "option1";
                
                questionData.options = {
                    "option1": { optionText: block.querySelector(".q-opt1").value, isCorrect: selectedValue === "option1" },
                    "option2": { optionText: block.querySelector(".q-opt2").value, isCorrect: selectedValue === "option2" },
                    "option3": { optionText: block.querySelector(".q-opt3").value, isCorrect: selectedValue === "option3" },
                    "option4": { optionText: block.querySelector(".q-opt4").value, isCorrect: selectedValue === "option4" }
                };
            }
            
            quizData.questions[`q${index + 1}`] = questionData;
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

if (categoryForm) {
    categoryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = categoryNameInput.value.trim();
        const editId = editCategoryIdInput.value;

        if (!name) return;

        // Ищем, есть ли категория с таким же названием (игнорируя регистр)
        const isDuplicate = Object.keys(allCategories).some(catId => {
            // Если мы редактируем эту же категорию, не считаем её дубликатом
            if (catId === editId) return false;
            
            // Сравниваем названия без учета регистра (приводим к нижнему регистру)
            return allCategories[catId].categoryName.toLowerCase() === name.toLowerCase();
        });

        if (isDuplicate) {
            alert(`Категория с названием "${name}" уже существует!`);
            return; // Прерываем выполнение, ничего не сохраняем
        }

        saveCategoryBtn.disabled = true;
        saveCategoryBtn.textContent = "Сохранение...";

        try {
            if (editId) {
                await update(ref(db, `categories/${editId}`), { categoryName: name });
                alert("Категория успешно обновлена!");
            } else {
                const newCatRef = push(ref(db, "categories"));
                await set(newCatRef, { categoryName: name });
                alert("Категория успешно добавлена!");
            }
            
            // Сброс формы
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

if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
        categoryForm.reset();
        editCategoryIdInput.value = "";
        saveCategoryBtn.textContent = "Добавить";
        cancelEditBtn.style.display = "none";
    });
}
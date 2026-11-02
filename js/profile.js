import { auth, db } from "./firebase.js";
import { ref, get, update, query, orderByChild, equalTo, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Элементы страницы
const profileEmail = document.getElementById("profileEmail");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const profileForm = document.getElementById("profileForm");
const historyList = document.getElementById("historyList");

let currentUser = null;

// Ждем, пока пользователь авторизуется
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    currentUser = user;
    profileEmail.value = user.email;

    // 1. Загружаем данные профиля из базы
    try {
        const userSnapshot = await get(ref(db, `users/${user.uid}`));
        const userData = userSnapshot.val();
        
        if (userData) {
            profileName.value = userData.displayName || "";
            // Переводим роль на русский для красоты
            profileRole.value = userData.role === "admin" ? "Администратор" : "Участник";
        }
    } catch (error) {
        console.error("Ошибка загрузки профиля:", error);
    }

    // 2. Загружаем историю попыток
    loadHistory(user.uid);
});

// Сохранение изменений
profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = profileForm.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Сохранение...";

    try {
        await update(ref(db, `users/${currentUser.uid}`), {
            displayName: profileName.value
        });
        alert("Профиль успешно обновлен!");
    } catch (error) {
        alert("Ошибка обновления: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Сохранить изменения";
    }
});

// Функция загрузки истории
async function loadHistory(uid) {
    try {
        // Делаем запрос: ищем в 'attempts' все записи, где userId === uid
        const attemptsRef = query(ref(db, 'attempts'), orderByChild('userId'), equalTo(uid));
        const snapshot = await get(attemptsRef);
        const data = snapshot.val();

        historyList.innerHTML = "";

        if (!data) {
            historyList.innerHTML = '<p class="empty-msg">Вы еще не проходили ни одного теста.</p>';
            return;
        }

        // Преобразуем объект в массив и сортируем по дате (новые сверху)
        const attemptsArray = Object.values(data).sort((a, b) => b.completedAt - a.completedAt);

        for (const attempt of attemptsArray) {
            // Загружаем название теста
            const quizSnap = await get(ref(db, `quizzes/${attempt.quizId}`));
            const quizTitle = quizSnap.exists() ? quizSnap.val().title : "Тест удален";

            const date = new Date(attempt.completedAt).toLocaleString("ru-RU", {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Определяем цвет балла
            let scoreColor, statusText, statusClass;

            if (attempt.score >= 80) {
                scoreColor = "#2ecc71";
                statusText = "Отлично";
                statusClass = "status-pass";
            } else if (attempt.score >= 60) {
                scoreColor = "#f1c40f"; // Желтый
                statusText = "Хорошо";
                statusClass = "status-warn"; // Новый класс для желтого
            } else {
                scoreColor = "#e74c3c";
                statusText = "Не сдано";
                statusClass = "status-fail";
            }

            const item = document.createElement("div");
            item.className = "history-item";

            item.innerHTML = `
                <div class="history-info">
                    <h4>${quizTitle}</h4>
                    <span class="history-date">${date}</span>
                    <span class="history-status ${statusClass}">${statusText}</span>
                </div>
                <div class="history-score" style="color: ${scoreColor};">
                    ${attempt.score}%
                </div>
            `;
            historyList.appendChild(item); 
        }

    } catch (error) {
        console.error("Ошибка загрузки истории:", error);
        historyList.innerHTML = '<p class="error-msg">Не удалось загрузить историю.</p>';
    }
}

// сброс прогресса
const resetProgressBtn = document.getElementById("resetProgressBtn");

if (resetProgressBtn) {
    resetProgressBtn.addEventListener("click", async () => {
        // Запрашиваем подтверждение
        const confirmReset = confirm("Вы уверены, что хотите удалить всю историю прохождений? Это действие нельзя отменить.");
        
        if (!confirmReset) return;

        if (!currentUser) {
            alert("Ошибка: пользователь не авторизован.");
            return;
        }

        resetProgressBtn.disabled = true;
        resetProgressBtn.textContent = "Очистка...";

        try {
            // 1. Находим все попытки текущего пользователя
            const attemptsRef = query(ref(db, 'attempts'), orderByChild('userId'), equalTo(currentUser.uid));
            const snapshot = await get(attemptsRef);
            const data = snapshot.val();

            if (!data) {
                alert("У вас нет сохраненной истории.");
                resetProgressBtn.disabled = false;
                resetProgressBtn.textContent = "Сбросить прогресс";
                return;
            }

            // 2. Удаляем каждую найденную попытку
            const deletePromises = Object.keys(data).map(attemptId => {
                return remove(ref(db, `attempts/${attemptId}`));
            });

            // Ждем завершения всех удалений
            await Promise.all(deletePromises);

            alert("История успешно очищена!");
            
            // Очищаем визуальный список (onValue в loadHistory сам подтянет пустоту, но для надежности можно очистить)
            historyList.innerHTML = '<p class="empty-msg">Вы еще не проходили ни одного теста.</p>';

        } catch (error) {
            console.error("Ошибка при сбросе прогресса:", error);
            alert("Не удалось очистить историю: " + error.message);
        } finally {
            resetProgressBtn.disabled = false;
            resetProgressBtn.textContent = "Сбросить прогресс";
        }
    });
}
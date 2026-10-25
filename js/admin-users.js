import { db, auth } from "./firebase.js";
import { ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const usersTable = document.getElementById("usersTable");

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

// Загружаем пользователей в реальном времени
onValue(ref(db, "users"), (snapshot) => {
    const data = snapshot.val();
    usersTable.innerHTML = "";

    if (!data) {
        usersTable.innerHTML = '<tr><td colspan="4">Нет пользователей</td></tr>';
        return;
    }

    Object.keys(data).forEach(uid => {
        const user = data[uid];
        
        // Запрещаем удалять самого себя
        const isCurrentUser = auth.currentUser && auth.currentUser.uid === uid;
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${user.displayName || "Без имени"}</td>
            <td>${user.email}</td>
            <td>
                <select class="role-select" data-id="${uid}" ${isCurrentUser ? 'disabled' : ''}>
                    <option value="participant" ${user.role === 'participant' ? 'selected' : ''}>Участник</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                </select>
            </td>
            <td class="actions">
                ${isCurrentUser ? '<span style="color:#95a5a6; font-size:12px;">(это вы)</span>' : 
                `<button class="btn-delete-row" data-id="${uid}" title="Удалить">🗑</button>`}
            </td>
        `;

        // Обработка смены роли
        const select = tr.querySelector(".role-select");
        if (select && !isCurrentUser) {
            select.addEventListener("change", async (e) => {
                const newRole = e.target.value;
                await update(ref(db, `users/${uid}`), { role: newRole });
                alert("Роль обновлена!");
            });
        }

        // Обработка удаления
        const delBtn = tr.querySelector(".btn-delete-row");
        if (delBtn) {
            delBtn.addEventListener("click", async () => {
                if (confirm(`Удалить пользователя ${user.displayName}?`)) {
                    // Примечание: это удалит только запись из базы данных.
                    // Аккаунт в Firebase Auth останется, но потеряет доступ к данным.
                    await remove(ref(db, `users/${uid}`));
                }
            });
        }

        usersTable.appendChild(tr);
    });
});
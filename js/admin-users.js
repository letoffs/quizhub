import { db, auth } from "./firebase.js";
import { ref, onValue, update, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const usersTable = document.getElementById("usersTable");

let currentUserRole = "participant";

// Проверяем, кто зашел
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const snap = await get(ref(db, `users/${user.uid}`));
    if (snap.exists()) {
        currentUserRole = snap.val().role;
    }
    
    if (currentUserRole === "participant") {
        alert("У вас нет прав для доступа к этой странице!");
        window.location.href = "index.html";
        return;
    }

    // Запускаем загрузку пользователей ТОЛЬКО после того, как узнали роль
    loadUsers();
});

function loadUsers() {
    onValue(ref(db, "users"), (snapshot) => {
        const data = snapshot.val();
        usersTable.innerHTML = "";

        if (!data) {
            usersTable.innerHTML = '<tr><td colspan="4">Нет пользователей</td></tr>';
            return;
        }

        Object.keys(data).forEach(uid => {
            const user = data[uid];
            
            const isCurrentUser = auth.currentUser && auth.currentUser.uid === uid;
            
            // Разрешаем менять роль, только если я АДМИН и это не я сам
            const canChangeRole = (currentUserRole === "admin") && !isCurrentUser;
            const selectDisabled = canChangeRole ? '' : 'disabled';

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${user.displayName || "Без имени"}</td>
                <td>${user.email}</td>
                <td>
                    <select class="role-select" data-id="${uid}" ${selectDisabled}>
                        <option value="participant" ${user.role === 'participant' ? 'selected' : ''}>Участник</option>
                        <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Модератор</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </td>
                <td class="actions">
                    ${isCurrentUser 
                        ? '<span style="color:#95a5a6; font-size:12px;">(это вы)</span>' 
                        : (currentUserRole === "admin" 
                            ? `<button class="btn-delete-row" data-id="${uid}" title="Удалить">🗑</button>`
                            : '<span style="color:#95a5a6; font-size:12px;">Нет прав</span>'
                          )
                    }
                </td>
            `;

            const select = tr.querySelector(".role-select");
            if (select && canChangeRole) {
                select.addEventListener("change", async (e) => {
                    const newRole = e.target.value;
                    try {
                        await update(ref(db, `users/${uid}`), { role: newRole });
                        alert("Роль обновлена!");
                    } catch (error) {
                        alert("Ошибка: " + error.message);
                    }
                });
            }

            const delBtn = tr.querySelector(".btn-delete-row");
            if (delBtn) {
                delBtn.addEventListener("click", async () => {
                    if (confirm(`Удалить пользователя ${user.displayName}?`)) {
                        try {
                            await remove(ref(db, `users/${uid}`));
                        } catch (error) {
                            alert("Ошибка удаления: " + error.message);
                        }
                    }
                });
            }

            usersTable.appendChild(tr);
        });
    });
}
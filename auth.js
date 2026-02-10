/**
 * Auth Logic for Glossy Girl
 * Handles API calls to Google Apps Script and Session Management
 */

const auth = {
    // Replace this with your Google Apps Script Web App URL
    apiUrl: "https://script.google.com/macros/s/AKfycbwFPbaOlkGT39a2TzefPyEN4Vfwkv7wuK83Ynj4AiWTPR1l6qNN6E5kd2veve9u4Czs/exec",

    // Session Management
    saveUser: (userData) => {
        localStorage.setItem('currentUser', JSON.stringify(userData));
    },

    getUser: () => {
        return JSON.parse(localStorage.getItem('currentUser'));
    },

    logout: () => {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    },

    checkAuth: () => {
        const user = auth.getUser();
        if (!user && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
            window.location.href = 'login.html';
        }
        return user;
    },

    // API Calls
    async register(username, password, email, role = 'User') {
        if (!this.apiUrl || this.apiUrl.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
            return { success: false, message: "ยังไม่ได้ตั้งค่า API URL ใน auth.js" };
        }

        try {
            console.log("Registering:", username);
            const url = `${this.apiUrl}?action=register&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}`;

            const response = await fetch(url);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
            }

            const result = await response.json();
            console.log("Registration Response:", result);
            return result;

        } catch (error) {
            console.error("Auth Register Error:", error);
            return { success: false, message: "เชื่อมต่อ Google Sheets ไม่สำเร็จ: " + error.toString() };
        }
    },

    async login(username, password) {
        try {
            const url = `${this.apiUrl}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                this.saveUser(result.user);
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (error) {
            return { success: false, message: "เชื่อมต่อล้มเหลว: กดยอมรับสิทธิ์ใน Apps Script" };
        }
    },

    // --- E-commerce Extensions ---
    async getProducts() {
        try {
            const response = await fetch(`${this.apiUrl}?action=getProducts`);
            return await response.json();
        } catch (e) { return { success: false }; }
    },

    async updateProfile(updates) {
        const user = this.getUser();
        try {
            const response = await fetch(`${this.apiUrl}?action=updateProfile`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    targetUser: user.username,
                    ...updates
                })
            });
            const result = await response.json();
            if (result.success) {
                // Update local session data
                const newUser = { ...user };
                if (updates.newEmail) newUser.email = updates.newEmail;
                if (updates.newAddress) newUser.address = updates.newAddress;
                if (updates.newAvatar) newUser.avatar = updates.newAvatar;
                if (updates.newPhone) newUser.phone = updates.newPhone;
                if (updates.newBirthday) newUser.birthday = updates.newBirthday;
                this.saveUser(newUser);
            }
            return result;
        } catch (e) { return { success: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อ: " + e.toString() }; }
    },

    async placeOrder(orderData) {
        try {
            const payload = {
                username: this.getUser().username,
                ...orderData
            };
            console.log("Placing Order Payload:", payload);
            const response = await fetch(`${this.apiUrl}?action=processOrder`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            console.log("Order Response:", result);
            return result;
        } catch (e) { return { success: false, message: e.toString() }; }
    },

    async getUserOrders() {
        try {
            const user = this.getUser();
            console.log("Fetching Orders for:", user.username);
            const response = await fetch(`${this.apiUrl}?action=getUserOrders&username=${encodeURIComponent(user.username)}`);
            const result = await response.json();
            console.log("History Result:", result);
            return result;
        } catch (e) { return { success: false, message: e.toString() }; }
    },

    // --- Admin Extensions ---
    async addProduct(productData) {
        try {
            const response = await fetch(`${this.apiUrl}?action=addProduct`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(productData)
            });
            return await response.json();
        } catch (e) { return { success: false, message: e.toString() }; }
    }
};

// Auto-check auth on load (optional, can be called per page)
// auth.checkAuth();

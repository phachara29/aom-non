const VERSION = "v2.2.1-stable";

const SHEETS = {
    USERS: 'Users',
    PRODUCTS: 'Products',
    SALES: 'Sales'
};

const USER_COLS = ['Username', 'Password', 'Email', 'Role', 'Address', 'Avatar', 'Phone', 'Birthday', 'CreatedAt'];
const SALE_COLS = ['OrderID', 'Username', 'Products', 'Total', 'PaymentMode', 'Address', 'Status', 'SlipURL', 'Date'];
const PROD_COLS = ['ID', 'Name', 'Price', 'Image', 'Category', 'Stock', 'Description', 'Tag'];

function doPost(e) { return handleRequest(e); }
function doGet(e) { return handleRequest(e); }

function handleRequest(e) {
    try {
        let data = {};
        if (e && e.parameter) { for (let key in e.parameter) { data[key] = e.parameter[key]; } }
        if (e && e.postData && e.postData.contents) {
            try {
                const postBody = JSON.parse(e.postData.contents);
                for (let key in postBody) { data[key] = postBody[key]; }
            } catch (pErr) { data.rawBody = e.postData.contents; }
        }

        if (!data.action) return response({ success: false, message: 'ไม่พบพารามิเตอร์ "action"', version: VERSION });

        const action = data.action.trim();
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        if (!ss) return response({ success: false, message: 'เกิดข้อผิดพลาดกับสเปรดชีต' });

        const sheets = {};
        Object.values(SHEETS).forEach(name => {
            sheets[name] = ss.getSheetByName(name) || ss.insertSheet(name);
            if (sheets[name].getLastRow() === 0) {
                if (name === SHEETS.USERS) sheets[name].appendRow(USER_COLS);
                if (name === SHEETS.PRODUCTS) sheets[name].appendRow(PROD_COLS);
                if (name === SHEETS.SALES) sheets[name].appendRow(SALE_COLS);
            }
        });

        switch (action) {
            case 'register': return handleRegister(sheets[SHEETS.USERS], data);
            case 'login': return handleLogin(sheets[SHEETS.USERS], data);
            case 'updateProfile': return updateProfile(sheets[SHEETS.USERS], data);
            case 'getProducts': return getProducts(sheets[SHEETS.PRODUCTS]);
            case 'addProduct': return addProduct(sheets[SHEETS.PRODUCTS], data);
            case 'updateStock': return updateStock(sheets[SHEETS.PRODUCTS], data);
            case 'processOrder': return processOrder(ss, data);
            case 'getUserOrders': return getUserOrders(sheets[SHEETS.SALES], data.username || data.targetUser);
            case 'getSalesStats': return getSalesStats(sheets[SHEETS.SALES]);
            case 'debug': return response({ success: true, dataReceived: data, version: VERSION });
            case 'test': return response({ success: true, message: 'เชื่อมต่อสำเร็จ!', version: VERSION });
            default: return response({ success: false, message: 'คำสั่งไม่ถูกต้อง: ' + action, version: VERSION });
        }
    } catch (err) {
        return response({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.toString(), version: VERSION });
    }
}

// --- Auth Functions ---
function handleRegister(sheet, data) {
    const rows = sheet.getDataRange().getValues();
    const uname = (data.username || "").toString().trim();
    if (rows.some(row => row[0].toString().toLowerCase() === uname.toLowerCase())) {
        return response({ success: false, message: 'มีชื่อนี้ในระบบแล้ว' });
    }
    sheet.appendRow([uname, data.password, data.email || '', 'User', '', '', '', '', new Date()]);
    return response({ success: true, message: 'สำเร็จ' });
}

function handleLogin(sheet, data) {
    const rows = sheet.getDataRange().getValues();
    const uname = (data.username || "").toString().trim().toLowerCase();
    const pass = (data.password || "").toString();

    const user = rows.find(row => row[0].toString().toLowerCase() === uname && row[1].toString() === pass);
    if (user) {
        return response({
            success: true,
            user: { username: user[0], email: user[2], role: user[3], address: user[4], avatar: user[5], phone: user[6], birthday: user[7] }
        });
    }
    return response({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
}

function updateProfile(sheet, data) {
    const rows = sheet.getDataRange().getValues();
    const target = (data.targetUser || "").toString().trim().toLowerCase();
    const rowIndex = rows.findIndex(row => row[0].toString().toLowerCase() === target);
    if (rowIndex === -1) return response({ success: false, message: 'ไม่พบผู้ใช้ในระบบ' });

    const rowNum = rowIndex + 1;
    if (data.newEmail) sheet.getRange(rowNum, 3).setValue(data.newEmail);
    if (data.newPassword) sheet.getRange(rowNum, 2).setValue(data.newPassword);
    if (data.newAddress) sheet.getRange(rowNum, 5).setValue(data.newAddress);
    if (data.newAvatar) sheet.getRange(rowNum, 6).setValue(data.newAvatar);
    if (data.newPhone) sheet.getRange(rowNum, 7).setValue(data.newPhone);
    if (data.newBirthday) sheet.getRange(rowNum, 8).setValue(data.newBirthday);

    return response({ success: true, message: 'อัปเดตเรียบร้อย' });
}

// --- Product Functions ---
function getProducts(sheet) {
    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    const products = values.map(row => {
        let obj = {};
        headers.forEach((h, i) => obj[h.toLowerCase()] = row[i]);
        return obj;
    });
    return response({ success: true, products: products });
}

function addProduct(sheet, data) {
    const id = "P" + (sheet.getLastRow() + 100);
    sheet.appendRow([id, data.name, data.price, data.image, data.category, data.stock, data.description, data.tag]);
    return response({ success: true, message: 'สำเร็จ' });
}

function updateStock(sheet, data) {
    const rows = sheet.getDataRange().getValues();
    const targetId = (data.productId || "").toString();
    const rowIndex = rows.findIndex(row => row[0].toString() === targetId);
    if (rowIndex === -1) return response({ success: false, message: 'ไม่พบสินค้า' });
    sheet.getRange(rowIndex + 1, 6).setValue(data.newStock);
    return response({ success: true, message: 'สำเร็จ' });
}

// --- Sales Functions ---
function processOrder(ss, data) {
    const productSheet = ss.getSheetByName(SHEETS.PRODUCTS);
    const salesSheet = ss.getSheetByName(SHEETS.SALES);

    const items = data.items || [];
    const pRows = productSheet.getDataRange().getValues();
    const log = [];

    items.forEach(item => {
        const itemId = (item.id || "").toString();
        const idx = pRows.findIndex(r => r[0].toString() === itemId);
        if (idx !== -1) {
            const currentStock = parseInt(pRows[idx][5]) || 0;
            const buyQty = parseInt(item.quantity) || 1;
            productSheet.getRange(idx + 1, 6).setValue(currentStock - buyQty);
            log.push(`${itemId}: ${currentStock} -> ${currentStock - buyQty}`);
        }
    });

    const orderId = "ORD" + Date.now();
    const status = data.paymentMode === 'COD' ? 'รอจัดส่ง (เก็บเงินปลายทาง)' : 'รอการตรวจสอบชำระเงิน';
    const username = (data.username || "Guest").toString().trim();

    salesSheet.appendRow([orderId, username, JSON.stringify(items), data.total, data.paymentMode, data.address, status, data.slipUrl || '', new Date()]);

    return response({ success: true, orderId: orderId, log: log });
}

function getUserOrders(sheet, username) {
    if (!username) return response({ success: false, message: 'กรุณาระบุชื่อผู้ใช้' });
    const target = username.toString().trim().toLowerCase();

    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return response({ success: true, orders: [] });

    values.shift(); // remove header
    const orders = values.filter(row => {
        const rowUser = (row[1] || "").toString().trim().toLowerCase();
        return rowUser === target;
    }).map(row => {
        const isOld = row.length < 9;
        return {
            orderId: row[0],
            items: row[2],
            total: row[3],
            paymentMode: row[4],
            address: row[5],
            status: isOld ? "สำเร็จแล้ว" : row[6],
            slip: isOld ? "" : row[7],
            date: isOld ? row[6] : row[8]
        };
    });
    return response({ success: true, orders: orders, count: orders.length });
}

function getSalesStats(sheet) {
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return response({ success: true, totalSales: 0, revenue: 0 });
    values.shift();
    const totalRevenue = values.reduce((sum, row) => sum + parseFloat(row[3] || 0), 0);
    return response({ success: true, totalSales: values.length, revenue: totalRevenue });
}

function response(content) {
    return ContentService.createTextOutput(JSON.stringify(content)).setMimeType(ContentService.MimeType.JSON);
}

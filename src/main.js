/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    if (!purchase || typeof purchase !== 'object') return 0;
    // Ищем любой массив объектов внутри purchase
    const possibleArrays = Object.values(purchase).filter(val => Array.isArray(val));
    let itemsArray = null;
    for (const arr of possibleArrays) {
        if (arr.length > 0 && arr[0] && typeof arr[0] === 'object' && 'sku' in arr[0]) {
            itemsArray = arr;
            break;
        }
    }
    if (!itemsArray) return 0;
    const item = itemsArray.find(i => i.sku === _product.sku);
    if (!item) return 0;
    const discount = item.discount ? 1 - item.discount / 100 : 1;
    return item.sale_price * item.quantity * discount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (index === 0) {
        return 0.15;
    } else if (index === 1 || index === 2) {
        return 0.1;
    } else if (index != (total - 1)) {
        return 0.05;
    } else {
        return 0;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    const { calculateRevenue, calculateBonus } = options;
    // Проверка входных данных
    if (!data || !Array.isArray(data.sellers) || data.sellers.length === 0) {
        throw new Error("Некорректные входные данные");
    }
    // Проверка наличия опций
    if (!(typeof options === "object") || !(typeof calculateRevenue === "function") || !(typeof calculateBonus === "function")) {
        throw new Error("Чего-то не хватает");
    }
    // Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        seller_id: seller.id,
        name: seller.first_name + " " + seller.last_name,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {},
        top_products: {},
        bonus: 0
    }));
    // Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(sellerStats.map(item => [item.seller_id, item]));
    const productIndex = Object.fromEntries(data.products.map(item => [item.sku, item]));
    // Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;
        seller.sales_count += 1;
        seller.revenue += record.total_amount;

        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return; // если товара нет в каталоге, пропускаем
            const cost = product.purchase_price * item.quantity;
            const revenue = calculateRevenue(record, product);
            const profit = revenue - cost;
            seller.profit += profit;

            // Учёт количества проданных товаров
            const sku = item.sku;
            seller.products_sold[sku] = (seller.products_sold[sku] || 0) + item.quantity;
        });
    });
    // Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);
    // Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });
    // Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +(seller.profit * seller.bonus).toFixed(2)
    }));
}
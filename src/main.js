/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // Если purchase сам является товаром (содержит sale_price и quantity)
    if (purchase && typeof purchase === 'object' && 'sale_price' in purchase && 'quantity' in purchase) {
        const discount = purchase.discount ? 1 - purchase.discount / 100 : 1;
        return purchase.sale_price * purchase.quantity * discount;
    }
    // Иначе ищем массив товаров в purchase (для реальных данных)
    if (!purchase || typeof purchase !== 'object') return 0;
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
    const profit = seller.profit;
    if (index === 0) {
        return profit * 0.15;
    } else if (index === 1 || index === 2) {
        return profit * 0.1;
    } else if (index !== total - 1) {
        return profit * 0.05;
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
    // Проверка входных данных
    if (!data || typeof data !== 'object') {
        throw new Error("Некорректные входные данные");
    }
    if (!Array.isArray(data.sellers) || data.sellers.length === 0) {
        throw new Error("Некорректные входные данные");
    }
    if (!Array.isArray(data.products) || data.products.length === 0) {
        throw new Error("Некорректные входные данные");
    }
    if (!Array.isArray(data.purchase_records) || data.purchase_records.length === 0) {
        throw new Error("Некорректные входные данные");
    }

    // Проверка опций
    if (!options || typeof options !== 'object') {
        throw new Error("Чего-то не хватает");
    }
    const { calculateRevenue, calculateBonus } = options;
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error("Чего-то не хватает");
    }

    // Подготовка промежуточных данных
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

    // Индексация для быстрого доступа
    const sellerIndex = Object.fromEntries(sellerStats.map(item => [item.seller_id, item]));
    const productIndex = Object.fromEntries(data.products.map(item => [item.sku, item]));

    // Обработка покупок
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

    // Сортировка по убыванию прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Назначение бонусов и формирование top_products
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // Подготовка итоговой коллекции
    return sellerStats.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}
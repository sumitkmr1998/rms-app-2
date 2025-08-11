// Mock data generator for MediPOS RMS Analytics
import { format, subDays, addDays } from 'date-fns';

export const generateMockSalesData = () => {
  const medicines = [
    { id: '1', name: 'Paracetamol 500mg', price: 5.00 },
    { id: '2', name: 'Amoxicillin 250mg', price: 15.00 },
    { id: '3', name: 'Vitamin D3', price: 30.00 },
    { id: '4', name: 'Aspirin 75mg', price: 5.00 },
    { id: '5', name: 'Omeprazole 20mg', price: 15.00 },
    { id: '6', name: 'Metformin 500mg', price: 8.00 },
    { id: '7', name: 'Atorvastatin 10mg', price: 25.00 },
    { id: '8', name: 'Lisinopril 10mg', price: 12.00 },
    { id: '9', name: 'Albuterol Inhaler', price: 45.00 },
    { id: '10', name: 'Ibuprofen 400mg', price: 6.00 }
  ];

  const paymentMethods = ['cash', 'card', 'upi'];
  const customers = [
    { name: 'John Doe', phone: '9876543210' },
    { name: 'Jane Smith', phone: '9876543211' },
    { name: 'Bob Johnson', phone: '9876543212' },
    null // Walk-in customer
  ];

  const sales = [];
  const startDate = subDays(new Date(), 30);
  
  for (let day = 0; day < 30; day++) {
    const currentDate = addDays(startDate, day);
    const transactionsPerDay = Math.floor(Math.random() * 10) + 5; // 5-15 transactions per day
    
    for (let transaction = 0; transaction < transactionsPerDay; transaction++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const itemsCount = Math.floor(Math.random() * 4) + 1; // 1-5 items per transaction
      
      const items = [];
      let totalAmount = 0;
      
      for (let item = 0; item < itemsCount; item++) {
        const medicine = medicines[Math.floor(Math.random() * medicines.length)];
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-4 quantity
        const itemTotal = medicine.price * quantity;
        
        items.push({
          medicine_id: medicine.id,
          medicine_name: medicine.name,
          quantity: quantity,
          price: medicine.price,
          total: itemTotal,
          is_return: false
        });
        
        totalAmount += itemTotal;
      }
      
      // Random discount application (20% chance)
      const hasDiscount = Math.random() < 0.2;
      let discountAmount = 0;
      let discountType = 'none';
      let discountValue = 0;
      
      if (hasDiscount) {
        discountType = Math.random() < 0.7 ? 'percentage' : 'fixed';
        if (discountType === 'percentage') {
          discountValue = Math.floor(Math.random() * 15) + 5; // 5-20% discount
          discountAmount = (totalAmount * discountValue) / 100;
        } else {
          discountValue = Math.floor(Math.random() * 50) + 10; // ₹10-60 fixed discount
          discountAmount = Math.min(discountValue, totalAmount);
        }
      }
      
      const finalAmount = totalAmount - discountAmount;
      
      // Random hour between 9 AM and 8 PM
      const hour = Math.floor(Math.random() * 12) + 9;
      const minute = Math.floor(Math.random() * 60);
      const transactionDate = new Date(currentDate);
      transactionDate.setHours(hour, minute, 0, 0);
      
      sales.push({
        id: `sale_${day}_${transaction}`,
        receipt_number: `RCP${String(day * 100 + transaction).padStart(6, '0')}`,
        items: items,
        total_amount: finalAmount,
        subtotal_amount: totalAmount,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        payment_method: paymentMethod,
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        cashier_id: 'admin',
        is_return: false,
        created_at: transactionDate
      });
    }
  }
  
  return sales;
};

export const generateStockMovements = (medicines) => {
  const movements = [];
  const startDate = subDays(new Date(), 30);
  
  medicines.forEach(medicine => {
    let currentStock = Math.floor(Math.random() * 200) + 100; // Starting stock 100-300
    
    for (let day = 0; day < 30; day++) {
      const currentDate = addDays(startDate, day);
      
      // Random stock additions (20% chance per day)
      if (Math.random() < 0.2) {
        const addedStock = Math.floor(Math.random() * 100) + 50; // Add 50-150 units
        const previousStock = currentStock;
        currentStock += addedStock;
        
        movements.push({
          id: `movement_${medicine.id}_${day}_add`,
          medicine_id: medicine.id,
          medicine_name: medicine.name,
          movement_type: 'addition',
          quantity_change: addedStock,
          previous_stock: previousStock,
          new_stock: currentStock,
          notes: 'New stock received',
          created_at: currentDate
        });
      }
      
      // Daily sales (reduce stock)
      const soldToday = Math.floor(Math.random() * 30) + 5; // 5-35 units sold
      if (currentStock >= soldToday) {
        const previousStock = currentStock;
        currentStock -= soldToday;
        
        movements.push({
          id: `movement_${medicine.id}_${day}_sale`,
          medicine_id: medicine.id,
          medicine_name: medicine.name,
          movement_type: 'sale',
          quantity_change: -soldToday,
          previous_stock: previousStock,
          new_stock: currentStock,
          notes: 'Regular sales',
          created_at: currentDate
        });
      }
    }
  });
  
  return movements;
};

export const processAnalyticsData = (sales) => {
  const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalTransactions = sales.length;
  const totalItems = sales.reduce((sum, sale) => 
    sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  
  // Top selling medicines
  const medicineStats = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      if (!medicineStats[item.medicine_id]) {
        medicineStats[item.medicine_id] = {
          medicine_id: item.medicine_id,
          name: item.medicine_name,
          quantity: 0,
          revenue: 0
        };
      }
      medicineStats[item.medicine_id].quantity += item.quantity;
      medicineStats[item.medicine_id].revenue += item.total;
    });
  });
  
  const topMedicines = Object.values(medicineStats)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
  
  // Daily sales
  const dailySales = {};
  sales.forEach(sale => {
    const day = format(sale.created_at, 'yyyy-MM-dd');
    dailySales[day] = (dailySales[day] || 0) + sale.total_amount;
  });
  
  const dailySalesArray = Object.entries(dailySales)
    .map(([date, sales]) => ({ date, sales }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Payment method breakdown
  const paymentBreakdown = {};
  sales.forEach(sale => {
    paymentBreakdown[sale.payment_method] = 
      (paymentBreakdown[sale.payment_method] || 0) + sale.total_amount;
  });
  
  // Hourly sales pattern
  const hourlySales = Array.from({length: 24}, () => 0);
  sales.forEach(sale => {
    const hour = sale.created_at.getHours();
    hourlySales[hour] += sale.total_amount;
  });
  
  const hourlySalesArray = hourlySales.map((sales, hour) => ({
    hour,
    sales,
    time: `${hour}:00`
  }));
  
  return {
    total_sales: totalSales,
    total_transactions: totalTransactions,
    total_items_sold: totalItems,
    top_selling_medicines: topMedicines,
    daily_sales: dailySalesArray,
    payment_method_breakdown: paymentBreakdown,
    hourly_sales_pattern: hourlySalesArray
  };
};
import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    
    // Declare all variables with safe defaults at the top
    let totalItems = 0
    let totalValue = 0
    let lowStockCount = 0
    let expiringSoonCount = 0
    let totalConsumedThisMonth = 0
    let costConsumedThisMonth = 0
    let mostConsumed = []
    let monthlyConsumption = []
    let thisMonthMovements = []

    // Total items
    try {
      totalItems = await db.collection('inventory_items').countDocuments({ 
        clinic_id: cid, 
        is_active: { $ne: false } 
      })
    } catch (e) {
      console.error('Error counting total items:', e)
    }
    
    // Total value (sum of current_stock * purchase_price)
    try {
      const items = await db.collection('inventory_items')
        .find({ clinic_id: cid, is_active: { $ne: false } })
        .project({ current_stock: 1, purchase_price: 1 })
        .toArray()
      totalValue = items.reduce((sum, item) => sum + ((item.current_stock || 0) * (item.purchase_price || 0)), 0)
    } catch (e) {
      console.error('Error calculating total value:', e)
    }
    
    // Low stock count
    try {
      lowStockCount = await db.collection('inventory_items').countDocuments({ 
        clinic_id: cid, 
        is_active: { $ne: false },
        $expr: { $lte: ['$current_stock', '$minimum_stock'] }
      })
    } catch (e) {
      console.error('Error counting low stock:', e)
    }
    
    // Expiring soon count (within 90 days)
    try {
      const today = new Date()
      const ninetyDaysLater = new Date()
      ninetyDaysLater.setDate(today.getDate() + 90)
      expiringSoonCount = await db.collection('inventory_items').countDocuments({ 
        clinic_id: cid, 
        is_active: { $ne: false },
        expiry_date: { $ne: null, $gte: today.toISOString(), $lte: ninetyDaysLater.toISOString() }
      })
    } catch (e) {
      console.error('Error counting expiring soon:', e)
    }
    
    // This month's consumption
    try {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      
      thisMonthMovements = await db.collection('stock_movements')
        .find({ 
          clinic_id: cid, 
          movement_type: 'STOCK_OUT',
          created_at: { $gte: monthStart }
        })
        .toArray()
      
      totalConsumedThisMonth = thisMonthMovements.reduce((sum, m) => sum + (m.quantity || 0), 0)
      costConsumedThisMonth = thisMonthMovements.reduce((sum, m) => sum + ((m.quantity || 0) * (m.purchase_cost || 0)), 0)
    } catch (e) {
      console.error('Error calculating this month consumption:', e)
    }
    
    // Most consumed items this month
    try {
      const consumptionByItem = {}
      thisMonthMovements.forEach(m => {
        if (!consumptionByItem[m.item_id]) {
          consumptionByItem[m.item_id] = { item_name: m.item_name, total_consumed: 0, unit: null }
        }
        consumptionByItem[m.item_id].total_consumed += (m.quantity || 0)
      })
      
      // Get units for items
      const itemIds = Object.keys(consumptionByItem)
      if (itemIds.length > 0) {
        const itemDetails = await db.collection('inventory_items')
          .find({ id: { $in: itemIds }, clinic_id: cid })
          .project({ id: 1, unit: 1 })
          .toArray()
        itemDetails.forEach(item => {
          if (consumptionByItem[item.id]) {
            consumptionByItem[item.id].unit = item.unit
          }
        })
      }
      
      mostConsumed = Object.values(consumptionByItem)
        .sort((a, b) => b.total_consumed - a.total_consumed)
        .slice(0, 5)
        .map(({ item_name, total_consumed, unit }) => ({ item_name, total_consumed, unit }))
    } catch (e) {
      console.error('Error calculating most consumed:', e)
    }
    
    // Monthly consumption for last 6 months
    try {
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date()
        monthDate.setMonth(monthDate.getMonth() - i)
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
        
        const monthMovements = await db.collection('stock_movements')
          .find({ 
            clinic_id: cid, 
            movement_type: 'STOCK_OUT',
            created_at: { $gte: monthStart, $lte: monthEnd }
          })
          .toArray()
        
        const totalOut = monthMovements.reduce((sum, m) => sum + (m.quantity || 0), 0)
        const cost = monthMovements.reduce((sum, m) => sum + ((m.quantity || 0) * (m.purchase_cost || 0)), 0)
        
        const monthName = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
        monthlyConsumption.push({ month: monthName, total_out: totalOut, cost })
      }
    } catch (e) {
      console.error('Error calculating monthly consumption:', e)
      monthlyConsumption = []
    }
    
    return json({
      total_items: totalItems,
      total_value: totalValue,
      low_stock_count: lowStockCount,
      expiring_soon_count: expiringSoonCount,
      total_consumed_this_month: totalConsumedThisMonth,
      cost_consumed_this_month: costConsumedThisMonth,
      most_consumed: mostConsumed,
      monthly_consumption: monthlyConsumption
    })
  } catch (e) {
    console.error('Analytics GET error:', e)
    return json({
      total_items: 0,
      total_value: 0,
      low_stock_count: 0,
      expiring_soon_count: 0,
      total_consumed_this_month: 0,
      cost_consumed_this_month: 0,
      most_consumed: [],
      monthly_consumption: []
    })
  }
}

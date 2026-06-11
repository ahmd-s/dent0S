import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    
    // Low stock items
    const lowStockItems = await db.collection('inventory_items')
      .find({ 
        clinic_id: cid, 
        is_active: true,
        $expr: { $lte: ['$current_stock', '$minimum_stock'] }
      })
      .sort({ current_stock: 1 })
      .toArray()
    
    // Sort by (current_stock / minimum_stock) ascending (most critical first)
    lowStockItems.sort((a, b) => {
      const ratioA = a.minimum_stock > 0 ? a.current_stock / a.minimum_stock : 0
      const ratioB = b.minimum_stock > 0 ? b.current_stock / b.minimum_stock : 0
      return ratioA - ratioB
    })
    
    // Expiring soon items (within 90 days)
    const today = new Date()
    const ninetyDaysLater = new Date()
    ninetyDaysLater.setDate(today.getDate() + 90)
    
    const expiringItems = await db.collection('inventory_items')
      .find({ 
        clinic_id: cid, 
        is_active: true,
        expiry_date: { $ne: null, $gte: today.toISOString(), $lte: ninetyDaysLater.toISOString() }
      })
      .toArray()
    
    // Calculate days remaining for each expiring item
    const expiringSoon = expiringItems.map(item => {
      const expiryDate = new Date(item.expiry_date)
      const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
      return { ...item, days_remaining: daysRemaining }
    }).sort((a, b) => a.days_remaining - b.days_remaining)
    
    return json({ 
      low_stock: lowStockItems.map(clean), 
      expiring_soon: expiringSoon.map(clean) 
    })
  } catch (e) {
    console.error('Alerts GET error:', e)
    return err('Internal server error', 500)
  }
}
